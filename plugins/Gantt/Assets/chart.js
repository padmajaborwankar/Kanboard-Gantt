// Based on jQuery.ganttView v.0.8.8 Copyright (c) 2010 JC Grubbs - jc.grubbs@devmynd.com - MIT License
var Gantt = function() {
    this.data = [];
    this.expandedSprints = new Set(); // Track which sprints are expanded

    this.options = {
        container: "#gantt-chart",
        showWeekends: true,
        showToday: true,
        allowMoves: true,
        allowResizes: true,
        cellWidth: 21,
        cellHeight: 31,
        slideWidth: 1000,
        vHeaderWidth: 200
    };
};

// Save record after a resize or move
Gantt.prototype.saveRecord = function(record) {
    $.ajax({
        cache: false,
        url: $(this.options.container).data("save-url"),
        contentType: "application/json",
        type: "POST",
        processData: false,
        data: JSON.stringify(record)
    });
};

// Build the Gantt chart
Gantt.prototype.show = function() {
    const sprintContainer = document.querySelector(this.options.container);
    const rawTasks = $(sprintContainer).data('records');
    const rawSprints = sprintContainer.getAttribute('data-sprints');

    let tasks = Array.isArray(rawTasks) ? rawTasks : [];
    let sprints = [];

    try {
        sprints = rawSprints ? JSON.parse(rawSprints) : [];
    } catch (e) {
        console.warn("❌ Could not parse sprints JSON:", e);
    }

    console.log("📦 SPRINTS:", sprints);
    console.log("🧩 TASKS:", tasks);

    // ✅ Group tasks by sprint_id
    const tasksBySprint = {};
    const addedTaskIds = new Set(); // ✅ To avoid duplicates

    // Create a "No Sprint" category for null sprint_id tasks
    tasksBySprint['no-sprint'] = [];

    tasks.forEach(t => {
        if (!t.sprint_id) {
            tasksBySprint['no-sprint'].push(t);
        } else {
            if (!tasksBySprint[t.sprint_id]) {
                tasksBySprint[t.sprint_id] = [];
            }
            tasksBySprint[t.sprint_id].push(t);
        }
    });

    // Adjust sprint dates based on tasks within each sprint
    this.adjustSprintDates(sprints, tasksBySprint);

    // ✅ Start merging sprints + their tasks
    const mergedData = [];

    // Add sprints first (tasks will be added when a sprint is clicked)
    sprints.forEach(sprint => {
        mergedData.push({
            type: 'sprint',
            id: 'sprint-' + sprint.id,
            sprint_id: sprint.id,
            title: '📦 ' + sprint.name,
            start: new Date(sprint.start_date * 1000),
            end: new Date(sprint.end_date * 1000),
            color: {
                background: '#ffeeba',
                border: '#f0ad4e',
            },
            assignee: '',
            progress: '0%',
            not_defined: false,
            has_tasks: tasksBySprint[sprint.id] && tasksBySprint[sprint.id].length > 0
        });
    });

    // Add "No Sprint" category if there are tasks without sprint_id
    if (tasksBySprint['no-sprint'].length > 0) {
        const noSprintTasks = tasksBySprint['no-sprint'];
        
        // Find earliest start date and latest end date for "No Sprint" category
        let earliestStart = new Date();
        let latestEnd = new Date();
        
        noSprintTasks.forEach((task, index) => {
            if (Array.isArray(task.start) && task.start.length === 3) {
                const taskStart = new Date(task.start[0], task.start[1] - 1, task.start[2]);
                if (index === 0 || taskStart < earliestStart) {
                    earliestStart = taskStart;
                }
            }
            
            if (Array.isArray(task.end) && task.end.length === 3) {
                const taskEnd = new Date(task.end[0], task.end[1] - 1, task.end[2]);
                if (index === 0 || taskEnd > latestEnd) {
                    latestEnd = taskEnd;
                }
            }
        });
        
        mergedData.push({
            type: 'sprint',
            id: 'sprint-no-sprint',
            sprint_id: 'no-sprint',
            title: '📦 No Sprint',
            start: earliestStart,
            end: latestEnd,
            color: {
                background: '#e9ecef',
                border: '#ced4da',
            },
            assignee: '',
            progress: '0%',
            not_defined: false,
            has_tasks: true
        });
    }

    // ✅ Process tasks for rendering
    tasks.forEach(task => {
        if (
            Array.isArray(task.start) && task.start.length === 3 &&
            Array.isArray(task.end) && task.end.length === 3
        ) {
            task.start = new Date(task.start[0], task.start[1] - 1, task.start[2]);
            task.end = new Date(task.end[0], task.end[1] - 1, task.end[2]);
            task.type = 'task';
            task.title = '↳ ' + task.title;
            
            // Don't add tasks to mergedData initially
            // They will be added dynamically when a sprint is clicked
        }
    });

    // Store original task data for later use when expanding sprints
    this.originalTasks = tasks;
    
    // ✅ Continue with rendering
    this.data = mergedData;

    const minDays = Math.floor((this.options.slideWidth / this.options.cellWidth) + 5);
    const range = this.getDateRange(minDays);
    const startDate = range[0];
    const endDate = range[1];
    const container = $(this.options.container);
    const chart = jQuery("<div>", { "class": "ganttview" });

    chart.append(this.renderVerticalHeader());
    chart.append(this.renderSlider(startDate, endDate));
    container.append(chart);

    jQuery("div.ganttview-grid-row div.ganttview-grid-row-cell:last-child", container).addClass("last");
    jQuery("div.ganttview-hzheader-days div.ganttview-hzheader-day:last-child", container).addClass("last");
    jQuery("div.ganttview-hzheader-months div.ganttview-hzheader-month:last-child", container).addClass("last");

    // Setup click handlers for sprints
    this.setupSprintClickHandlers(startDate, endDate);

    if (!$(this.options.container).data('readonly')) {
        this.listenForBlockResize(startDate);
        this.listenForBlockMove(startDate);
    } else {
        this.options.allowResizes = false;
        this.options.allowMoves = false;
    }
};

// Adjust sprint dates based on tasks within each sprint
Gantt.prototype.adjustSprintDates = function(sprints, tasksBySprint) {
    sprints.forEach(sprint => {
        const sprintTasks = tasksBySprint[sprint.id] || [];
        
        if (sprintTasks.length > 0) {
            let earliestStart = null;
            let latestEnd = null;
            
            sprintTasks.forEach(task => {
                if (Array.isArray(task.start) && task.start.length === 3) {
                    const taskStart = new Date(task.start[0], task.start[1] - 1, task.start[2]);
                    if (!earliestStart || taskStart < earliestStart) {
                        earliestStart = taskStart;
                    }
                }
                
                if (Array.isArray(task.end) && task.end.length === 3) {
                    const taskEnd = new Date(task.end[0], task.end[1] - 1, task.end[2]);
                    if (!latestEnd || taskEnd > latestEnd) {
                        latestEnd = taskEnd;
                    }
                }
            });
            
            // Update sprint dates if tasks exist
            if (earliestStart && latestEnd) {
                sprint.start_date = Math.floor(earliestStart.getTime() / 1000);
                sprint.end_date = Math.floor(latestEnd.getTime() / 1000);
            }
        }
    });
};

// Setup click handlers for expanding/collapsing sprints
Gantt.prototype.setupSprintClickHandlers = function(startDate, endDate) {
    const self = this;
    const container = $(this.options.container);

    // Use event delegation to attach the click handler to a persistent parent element
    container.off('click', '.ganttview-vtheader-series-name[data-sprint-id]'); // Remove any previous handlers
    container.on('click', '.ganttview-vtheader-series-name[data-sprint-id]', function() {
        const sprintId = $(this).data('sprint-id');

        if (self.expandedSprints.has(sprintId)) {
            // Collapse: remove tasks for this sprint
            self.expandedSprints.delete(sprintId);
            self.collapseSprintTasks(sprintId, startDate, endDate);
        } else {
            // Expand: add tasks for this sprint
            self.expandedSprints.add(sprintId);
            self.expandSprintTasks(sprintId, startDate, endDate);
        }

        // Toggle visual indicator
        $(this).toggleClass('expanded');
    });
};

// Expand sprint to show tasks
Gantt.prototype.expandSprintTasks = function(sprintId, startDate, endDate) {
    const self = this;
    const container = $(this.options.container);
    const sprintIndex = this.findSprintIndex(sprintId);
    
    if (sprintIndex === -1) return;
    
    // Get tasks for this sprint
    let tasksToAdd = [];
    if (sprintId === 'no-sprint') {
        tasksToAdd = this.originalTasks.filter(t => !t.sprint_id);
    } else {
        tasksToAdd = this.originalTasks.filter(t => t.sprint_id === sprintId);
    }
    
    // Insert tasks after the sprint in the data array
    tasksToAdd.forEach((task, i) => {
        this.data.splice(sprintIndex + 1 + i, 0, task);
    });
    
    // Redraw the chart
    this.redrawChart(startDate, endDate);
};

// Collapse sprint to hide tasks
Gantt.prototype.collapseSprintTasks = function(sprintId, startDate, endDate) {
    const self = this;
    
    // Remove tasks for this sprint from the data array
    if (sprintId === 'no-sprint') {
        this.data = this.data.filter(item => !(item.type === 'task' && !item.sprint_id));
    } else {
        this.data = this.data.filter(item => !(item.type === 'task' && item.sprint_id === sprintId));
    }
    
    // Redraw the chart
    this.redrawChart(startDate, endDate);
};

// Redraw the chart with updated data
Gantt.prototype.redrawChart = function(startDate, endDate) {
    const container = $(this.options.container);
    
    // Clear existing chart
    container.empty();
    
    // Redraw chart with updated data
    const chart = jQuery("<div>", { "class": "ganttview" });
    chart.append(this.renderVerticalHeader());
    chart.append(this.renderSlider(startDate, endDate));
    container.append(chart);
    
    jQuery("div.ganttview-grid-row div.ganttview-grid-row-cell:last-child", container).addClass("last");
    jQuery("div.ganttview-hzheader-days div.ganttview-hzheader-day:last-child", container).addClass("last");
    jQuery("div.ganttview-hzheader-months div.ganttview-hzheader-month:last-child", container).addClass("last");
    
    // Re-setup click handlers
    this.setupSprintClickHandlers(startDate, endDate);
    
    // Re-setup resize/move handlers
    if (!container.data('readonly')) {
        this.listenForBlockResize(startDate);
        this.listenForBlockMove(startDate);
    }
};

// Find index of a sprint in the data array
Gantt.prototype.findSprintIndex = function(sprintId) {
    for (let i = 0; i < this.data.length; i++) {
        if (this.data[i].type === 'sprint' && this.data[i].sprint_id === sprintId) {
            return i;
        }
    }
    return -1;
};

Gantt.prototype.infoTooltip = function(content) {
    var markdown = $("<div>", {"class": "markdown"}).append(content);
    var script = $("<script>", {"type": "text/template"}).append(markdown);
    var icon = $('<i>', {"class": "fa fa-info-circle"});
    return $('<span>', {"class": "tooltip"}).append(icon).append(script);
};

// Render record list on the left
Gantt.prototype.renderVerticalHeader = function() {
    var headerDiv = jQuery("<div>", { "class": "ganttview-vtheader" });
    var itemDiv = jQuery("<div>", { "class": "ganttview-vtheader-item" });
    var seriesDiv = jQuery("<div>", { "class": "ganttview-vtheader-series" });

    for (var i = 0; i < this.data.length; i++) {
        var content = jQuery("<span>")
            .append(this.infoTooltip(this.getVerticalHeaderTooltip(this.data[i])))
            .append("&nbsp;");
 
        if (this.data[i].type === 'task') {
            content.append(jQuery('<strong>').text('#'+this.data[i].id+' '));
            content.append(jQuery("<a>", {"href": this.data[i].link, "title": this.data[i].title}).text(this.data[i].title));
            
            var seriesName = jQuery("<div>", {
                "class": "ganttview-vtheader-series-name task-item",
                "data-task-id": this.data[i].id
            }).append(content);
            
            seriesDiv.append(seriesName);
        }
        else {
            // Add expand/collapse indicator for sprints
            
            content
                .append(jQuery("<a>", {"href": this.data[i].link}).text(this.data[i].title));
            
            // Add task count indicator
            if (this.data[i].has_tasks) {
                content.append("&nbsp;");
                var taskCountSpan = jQuery("<span>", {"class": "task-count"}).text(
                    "(" + (this.data[i].sprint_id === 'no-sprint' ? 
                        this.originalTasks.filter(t => !t.sprint_id).length : 
                        this.originalTasks.filter(t => t.sprint_id === this.data[i].sprint_id).length) + 
                    " tasks)"
                );
                content.append(taskCountSpan);
            }
            
            var seriesName = jQuery("<div>", {
                "class": "ganttview-vtheader-series-name sprint-item",
                "data-sprint-id": this.data[i].sprint_id
            }).append(content);
            
            seriesDiv.append(seriesName);
        }
    }

    itemDiv.append(seriesDiv);
    headerDiv.append(itemDiv);

    return headerDiv;
    
};

// Render right part of the chart (top header + grid + bars)
Gantt.prototype.renderSlider = function(startDate, endDate) {
    var slideDiv = jQuery("<div>", {"class": "ganttview-slide-container"});
    var dates = this.getDates(startDate, endDate);

    slideDiv.append(this.renderHorizontalHeader(dates));
    slideDiv.append(this.renderGrid(dates));
    slideDiv.append(this.addBlockContainers());
    this.addBlocks(slideDiv, startDate);

    return slideDiv;
};

// Render top header (days)
Gantt.prototype.renderHorizontalHeader = function(dates) {
    
    var headerDiv = jQuery("<div>", { "class": "ganttview-hzheader" });
    var monthsDiv = jQuery("<div>", { "class": "ganttview-hzheader-months" });
    var daysDiv = jQuery("<div>", { "class": "ganttview-hzheader-days" });
    var totalW = 0;

    for (var y in dates) {
        for (var m in dates[y]) {
            var w = dates[y][m].length * this.options.cellWidth;
            totalW = totalW + w;

            monthsDiv.append(jQuery("<div>", {
                "class": "ganttview-hzheader-month",
                "css": { "width": (w - 1) + "px" }
            }).append($.datepicker.regional[$("html").attr('lang')].monthNames[m] + " " + y));

            for (var d in dates[y][m]) {
                daysDiv.append(jQuery("<div>", { "class": "ganttview-hzheader-day" }).append(dates[y][m][d].getDate()));
            }
        }
    }

    monthsDiv.css("width", totalW + "px");
    daysDiv.css("width", totalW + "px");
    headerDiv.append(monthsDiv).append(daysDiv);

    return headerDiv;
};

// Render grid
Gantt.prototype.renderGrid = function(dates) {
    var gridDiv = jQuery("<div>", { "class": "ganttview-grid" });
    var rowDiv = jQuery("<div>", { "class": "ganttview-grid-row" });

    for (var y in dates) {
        for (var m in dates[y]) {
            for (var d in dates[y][m]) {
                var cellDiv = jQuery("<div>", { "class": "ganttview-grid-row-cell" });
                if (this.options.showWeekends && this.isWeekend(dates[y][m][d])) {
                    cellDiv.addClass("ganttview-weekend");
                }
                if (this.options.showToday && this.isToday(dates[y][m][d])) {
                    cellDiv.addClass("ganttview-today");
                }
                rowDiv.append(cellDiv);
            }
        }
    }
    var w = jQuery("div.ganttview-grid-row-cell", rowDiv).length * this.options.cellWidth;
    rowDiv.css("width", w + "px");
    gridDiv.css("width", w + "px");

    for (var i = 0; i < this.data.length; i++) {
        gridDiv.append(rowDiv.clone());
    }

    return gridDiv;
};

// Render bar containers
Gantt.prototype.addBlockContainers = function() {
    var blocksDiv = jQuery("<div>", { "class": "ganttview-blocks" });

    for (var i = 0; i < this.data.length; i++) {
        blocksDiv.append(jQuery("<div>", { "class": "ganttview-block-container" }));
    }

    return blocksDiv;
};

// Render bars
Gantt.prototype.addBlocks = function(slider, start) {
    var rows = jQuery("div.ganttview-blocks div.ganttview-block-container", slider);
    var rowIdx = 0;

    for (var i = 0; i < this.data.length; i++) {
        var series = this.data[i];
        var size = this.daysBetween(series.start, series.end) + 1;
        var offset = this.daysBetween(start, series.start);
        var text = jQuery("<div>", {
          "class": "ganttview-block-text",
          "css": {
              "width": ((size * this.options.cellWidth) - 19) + "px"
          }
        });

        var block = jQuery("<div>", {
            "class": "ganttview-block" + (this.options.allowMoves ? " ganttview-block-movable" : ""),
            "css": {
                "width": ((size * this.options.cellWidth) - 9) + "px",
                "margin-left": (offset * this.options.cellWidth) + "px"
            }
        }).append(text);

        if (series.type === 'task') {
            this.addTaskBarText(text, series, size);
        }

        block.data("record", series);
        this.setBarColor(block, series);

        jQuery(rows[rowIdx]).append(block);
        rowIdx = rowIdx + 1;
    }
};

Gantt.prototype.addTaskBarText = function(container, record, size) {
    var textSpan = $('<span>')
    .html('<strong>' + record.title + ' ' + record.progress + '</strong> ' + record.assignee);    
    
    container.html(textSpan);
    container.css({
        "position": "absolute",
        "left": "100%",
        "margin-left": "3px",
        "top": "50%",
        "transform": "translateY(-50%)"
    });
};

// Get tooltip for vertical header
Gantt.prototype.getVerticalHeaderTooltip = function(record) {
    if (record.type === 'task') {
        return this.getTaskTooltip(record);
    }

    return this.getProjectTooltip(record);
};

Gantt.prototype.getTaskTooltip = function(record) {
    var assigneeLabel = $(this.options.container).data("label-assignee");
    var tooltip = $('<span>')
        .append($('<strong>').text(record.column_title + ' (' + record.progress + ')'))
        .append($('<br>'))
        .append($('<span>').text('#' + record.id + ' ' + record.title))
        .append($('<br>'))
        .append($('<span>').text(assigneeLabel + ' ' + (record.assignee ? record.assignee : '')));

    return this.getTooltipFooter(record, tooltip);
};

Gantt.prototype.getProjectTooltip = function(record) {
    var tooltip = $('<span>');

    if (record.users && 'project-manager' in record.users) 
        {
        var projectManagerLabel = $(this.options.container).data('label-project-manager');
        var list = $('<ul>');

        for (var user_id in record.users['project-manager']) {
            list.append($('<li>').append($('<span>').text(record.users['project-manager'][user_id])));
        }

        tooltip.append($('<strong>').text(projectManagerLabel));
        tooltip.append($('<br>'));
        tooltip.append(list);
    }

    return this.getTooltipFooter(record, tooltip);
};

Gantt.prototype.getTooltipFooter = function(record, tooltip) {
    var notDefinedLabel = $(this.options.container).data("label-not-defined");
    var startDateLabel = $(this.options.container).data("label-start-date");
    var startEndLabel = $(this.options.container).data("label-end-date");

    if (record.not_defined) {
        tooltip.append($('<br>')).append($('<em>').text(notDefinedLabel));
    } else {
        tooltip.append($('<br>'));
        tooltip.append($('<strong>').text(startDateLabel + ' ' + $.datepicker.formatDate('yy-mm-dd', record.start)));
        tooltip.append($('<br>'));
        tooltip.append($('<strong>').text(startEndLabel + ' ' + $.datepicker.formatDate('yy-mm-dd', record.end)));
    }

    return tooltip;
};

// Set bar color
Gantt.prototype.setBarColor = function(block, record) {
    block.css("background-color", record.color.background);
    block.css("border-color", record.color.border);

    if (record.not_defined) {
        if (record.date_started_not_defined) {
            block.css("border-left", "2px solid #000");
        }

        if (record.date_due_not_defined) {
            block.css("border-right", "2px solid #000");
        }
    }

    if (record.progress != "0%") {
        var progressBar = $(block).find(".ganttview-progress-bar");

        if (progressBar.length) {
            progressBar.css("width", record.progress);
        } else {
            block.append(jQuery("<div>", {
                "class": "ganttview-progress-bar",
                "css": {
                    "background-color": record.color.border,
                    "width": record.progress,
                }
            }));
            
        }
    }
    
};

Gantt.prototype.listenForBlockResize = function(startDate) {
    var self = this;

    jQuery("div.ganttview-block", this.options.container).each(function() {
        var block = jQuery(this);
        var record = block.data("record");

        // Skip sprint blocks
        if (block.hasClass("ganttview-sprint") || (record && record.type === "sprint")) {
            block.css("cursor", "default"); // Optional: ensure no resize/move cursor
            return;
        }

        // Apply resizable only to non-sprint blocks
        block.resizable({
            grid: self.options.cellWidth,
            handles: "e,w",
            delay: 300,
            resize: function(event, ui) {
                self.updateDataAndPosition(block, startDate);

                // Keep text aligned during resize
                var blockText = block.data("text-element");
                if (blockText) {
                    var taskbarOffset = block.offset();
                    var taskbarWidth = block.outerWidth();
                    blockText.css({
                        left: taskbarOffset.left + taskbarWidth + "px",
                        top: taskbarOffset.top + block.outerHeight() / 2 - blockText.outerHeight() / 2 + "px",
                    });
                }
            },
            stop: function() {
                self.updateDataAndPosition(block, startDate);
                self.saveRecord(record);
            }
        });
    });
};

// Setup jquery-ui drag and drop
Gantt.prototype.listenForBlockMove = function(startDate) {
    var self = this;

    // Only apply draggable to non-sprint blocks
    jQuery("div.ganttview-block", this.options.container).each(function() {
        var block = jQuery(this);
        var record = block.data("record");

        // Skip sprint blocks
        if (block.hasClass("ganttview-sprint") || (record && record.type === "sprint")) {
            block.css("cursor", "default"); // Make sure cursor is not a move cursor
            return;
        }

        // Make non-sprint blocks draggable
        block.draggable({
            axis: "x",
            delay: 300,
            grid: [self.options.cellWidth, self.options.cellWidth],
            stop: function() {
                self.updateDataAndPosition(block, startDate);
                self.saveRecord(record);
            }
        });
    });
};

// Update the record data and the position on the chart
Gantt.prototype.updateDataAndPosition = function(block, startDate) {
    var container = jQuery("div.ganttview-slide-container", this.options.container);
    var scroll = container.scrollLeft();
    var offset = block.offset().left - container.offset().left - 1 + scroll;
    var record = block.data("record");

    // Restore color for defined block
    record.not_defined = false;
    this.setBarColor(block, record);

    // Set new start date
    var daysFromStart = Math.round(offset / this.options.cellWidth);
    var newStart = this.addDays(this.cloneDate(startDate), daysFromStart);
    if (!record.date_started_not_defined || this.compareDate(newStart, record.start)) {
        record.start = this.addDays(this.cloneDate(startDate), daysFromStart);
        record.date_started_not_defined = true;
    }
    else if (record.date_started_not_defined) {
        delete record.start;
    }

    // Set new end date
    var width = block.outerWidth();
    var numberOfDays = Math.round(width / this.options.cellWidth) - 1;
    var newEnd = this.addDays(this.cloneDate(newStart), numberOfDays);
    if (!record.date_due_not_defined || this.compareDate(newEnd, record.end)) {
        record.end = newEnd;
        record.date_due_not_defined = true;
    }
    else if (record.date_due_not_defined) {
        delete record.end;
    }

    if (record.type === "task" && numberOfDays > 0) {
        this.addTaskBarText(jQuery("div.ganttview-block-text", block), record, numberOfDays);
    }

    block.data("record", record);

    // Remove top and left properties to avoid incorrect block positioning,
    // set position to relative to keep blocks relative to scrollbar when scrolling
    block
        .css("top", "")
        .css("left", "")
        .css("position", "relative")
        .css("margin-left", offset + "px");
};

// Creates a 3 dimensional array [year][month][day] of every day
// between the given start and end dates
Gantt.prototype.getDates = function(start, end) {
    var dates = [];
    dates[start.getFullYear()] = [];
    dates[start.getFullYear()][start.getMonth()] = [start];
    var last = start;

    while (this.compareDate(last, end) == -1) {
        var next = this.addDays(this.cloneDate(last), 1);

        if (! dates[next.getFullYear()]) {
            dates[next.getFullYear()] = [];
        }

        if (! dates[next.getFullYear()][next.getMonth()]) {
            dates[next.getFullYear()][next.getMonth()] = [];
        }

        dates[next.getFullYear()][next.getMonth()].push(next);
        last = next;
    }

    return dates;
};

// Convert data to Date object
// Convert data to Date object
Gantt.prototype.prepareData = function(data) {
    const validData = [];

    for (var i = 0; i < data.length; i++) {
        var item = data[i];

        if (!Array.isArray(item.start) || item.start.length !== 3 ||
            !Array.isArray(item.end) || item.end.length !== 3) {
            console.warn("⚠️ Skipping item with invalid dates:", item);
            continue;
        }

        try {
            item.start = new Date(item.start[0], item.start[1] - 1, item.start[2]);
            item.end = new Date(item.end[0], item.end[1] - 1, item.end[2]);

            if (isNaN(item.start) || isNaN(item.end)) {
                console.warn("⚠️ Skipping item with NaN dates:", item);
                continue;
            }

            validData.push(item);
        } catch (e) {
            console.error("❌ Failed to parse date:", item, e);
        }
    }

    return validData;
};

// Get the start and end date from the data provided
Gantt.prototype.getDateRange = function(minDays) {
    var minStart = new Date();
    var maxEnd = new Date();

    for (var i = 0; i < this.data.length; i++) {
        var start = new Date();
        start.setTime(Date.parse(this.data[i].start));

        var end = new Date();
        end.setTime(Date.parse(this.data[i].end));

        if (i == 0) {
            minStart = start;
            maxEnd = end;
        }

        if (this.compareDate(minStart, start) == 1) {
            minStart = start;
        }

        if (this.compareDate(maxEnd, end) == -1) {
            maxEnd = end;
        }
    }

    // Insure that the width of the chart is at least the slide width to avoid empty
    // whitespace to the right of the grid
    if (this.daysBetween(minStart, maxEnd) < minDays) {
        maxEnd = this.addDays(this.cloneDate(minStart), minDays);
    }

    // Always start one day before the minStart
    minStart.setDate(minStart.getDate() - 1);

    return [minStart, maxEnd];
};

// Returns the number of day between 2 dates
Gantt.prototype.daysBetween = function(start, end) {
    if (! start || ! end) {
        return 0;
    }

    var count = 0, date = this.cloneDate(start);

    while (this.compareDate(date, end) == -1) {
        count = count + 1;
        this.addDays(date, 1);
    }

    return count;
};

// Return true if it's the weekend
Gantt.prototype.isWeekend = function(date) {
    return date.getDay() % 6 == 0;
};

// Return true if it's today
Gantt.prototype.isToday = function(date) {
   var today = new Date();
   return today.toDateString() == date.toDateString();
 };

// Clone Date object
Gantt.prototype.cloneDate = function(date) {
    return new Date(date.getTime());
};

// Add days to a Date object
Gantt.prototype.addDays = function(date, value) {
    date.setDate(date.getDate() + value * 1);
    return date;
};

/**
 * Compares the first date to the second date and returns an number indication of their relative values.
 *
 * -1 = date1 is lessthan date2
 * 0 = values are equal
 * 1 = date1 is greaterthan date2.
 */
Gantt.prototype.compareDate = function(date1, date2) {
    if (isNaN(date1) || isNaN(date2)) {
        throw new Error(date1 + " - " + date2);
    } else if (date1 instanceof Date && date2 instanceof Date) {
        return (date1 < date2) ? -1 : (date1 > date2) ? 1 : 0;
    } else {
        throw new TypeError(date1 + " - " + date2);
    }
};

// Add CSS styles for sprint expansion/collapse
(function() {
    var style = document.createElement('style');
    style.type = 'text/css';
    style.innerHTML = `
        .ganttview-vtheader-series-name.sprint-item {
            cursor: pointer;
            font-weight: bold;
            background-color: #f8f9fa;
            border-radius: 3px;
            padding: 2px 5px;
        }
        
        .ganttview-vtheader-series-name.sprint-item:hover {
            background-color: #e9ecef;
        }
        
        .ganttview-vtheader-series-name.expanded .fa-plus-square-o:before {
            content: "\\f147"; /* fa-minus-square-o */
        }
        
        .task-count {
            font-size: 0.9em;
            color: #6c757d;
            font-weight: normal;
        }
        
        .task-item {
            padding-left: 15px;
        }
    `;
    document.head.appendChild(style);
})();
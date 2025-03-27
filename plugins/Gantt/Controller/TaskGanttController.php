<?php

namespace Kanboard\Plugin\Gantt\Controller;

use Kanboard\Controller\BaseController;
use Kanboard\Model\TaskModel;

/**
 * Tasks Gantt Controller
 *
 * @package  Kanboard\Controller
 */
class TaskGanttController extends BaseController
{
    /**
     * Show Gantt chart for one project
     */
    public function show()
{
    error_log("✅ TaskGanttController@show HIT!");

    $project = $this->getProject();
    $search = $this->helper->projectHeader->getSearchQuery($project);
    $sorting = $this->request->getStringParam('sorting', '');
    $filter = $this->taskLexer->build($search);

    // ✅ Set default sorting if none is provided
    if ($sorting === '') {
        $sorting = $this->configModel->get('gantt_task_sort', 'board');
    }

    // ✅ Apply sorting logic
    if ($sorting === 'date') {
        $filter->getQuery()->asc(TaskModel::TABLE . '.date_started')->asc(TaskModel::TABLE . '.date_creation');
    } else {
        $filter->getQuery()->asc('column_position')->asc(TaskModel::TABLE . '.position');
    }

    // ✅ Fetch sprints for this project
    $sprints = $this->db->table('sprints')->eq('project_id', $project['id'])->findAll();

    // ✅ Render the view
    $this->response->html($this->helper->layout->app('Gantt:task_gantt/show', [
        'project' => $project,
        'title' => $project['name'],
        'description' => $this->helper->projectHeader->getDescription($project),
        'sorting' => $sorting,
        'tasks' => $filter->format($this->taskGanttFormatter),
        'sprints' => $sprints, // 👈 this passes $sprints to the view
    ]));

}


    /**
     * Save new task start date and due date
     */
    public function save()
    {
        $changes = $this->request->getJson();
        $values = [];
    
        if (! empty($changes['start'])) {
            $values['date_started'] = strtotime($changes['start']);
        }
    
        if (! empty($changes['end'])) {
            $values['date_due'] = strtotime($changes['end']);
        }
    
        if (! empty($values)) {
            $values['id'] = $changes['id'];
            $result = $this->taskModificationModel->update($values);
    
            if (! $result) {
                $this->response->json(array('message' => 'Unable to save task'), 400);
            } else {
                $this->response->json(array('message' => 'OK'), 201);
            }
        } else {
            $this->response->json(array('message' => 'Ignored'), 200);
        }
    }
}
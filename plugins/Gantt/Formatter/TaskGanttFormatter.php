<?php

namespace Kanboard\Plugin\Gantt\Formatter;

use Kanboard\Formatter\BaseFormatter;
use Kanboard\Core\Filter\FormatterInterface;

/**
 * Task Gantt Formatter
 *
 * @package formatter
 * @author  Frederic Guillot
 */
class TaskGanttFormatter extends BaseFormatter implements FormatterInterface
{
    /**
     * Local cache for project columns
     *
     * @access private
     * @var array
     */
    private $columns = array();

    /**
     * Apply formatter
     *
     * @access public
     * @return array
     */
    public function format()
    {
        $bars = array();
        $tasks = $this->query->findAll();
        $taskIds = array_column($tasks, 'id');
        $dependencies = $this->taskDependencyModel->getDependenciesByTaskIds($taskIds);

        foreach ($tasks as $task) {
            $taskId = $task['id'];
            $task['dependencies'] = $dependencies[$taskId] ?? [];
            $bars[] = $this->formatTask($task);
        }

        return $bars;
    }

    /**
     * Format a single task
     *
     * @access private
     * @param  array  $task
     * @return array
     */
    private function formatTask(array $task)
    {
        if (! isset($this->columns[$task['project_id']])) {
            $this->columns[$task['project_id']] = $this->columnModel->getList($task['project_id']);
        }

        $start = $task['date_started'] ?: time();
        $end = $task['date_due'] ?: $start;

        return array(
            'type' => 'task',
            'id' => $task['id'],
            'title' => $task['title'],
            'sprint_id' => isset($task['sprint_id']) ? $task['sprint_id'] : null,


            'start' => array(
    (int) date('Y', is_numeric($start) ? $start : strtotime($start)),
    (int) date('n', is_numeric($start) ? $start : strtotime($start)),
    (int) date('j', is_numeric($start) ? $start : strtotime($start)),
),
'end' => array(
    (int) date('Y', is_numeric($end) ? $end : strtotime($end)),
    (int) date('n', is_numeric($end) ? $end : strtotime($end)),
    (int) date('j', is_numeric($end) ? $end : strtotime($end)),
),

            'column_title' => $task['column_name'] ?? '',
            'assignee' => $task['assignee_name'] ?? ($task['assignee_username'] ?? 'Unassigned'),
            'progress' => $this->taskModel->getProgress($task, $this->columns[$task['project_id']]).'%',
            'link' => $this->helper->url->href('TaskViewController', 'show', array('project_id' => $task['project_id'], 'task_id' => $task['id'])),
            'color' => $this->colorModel->getColorProperties($task['color_id']),
            'not_defined' => empty($task['date_due']) || empty($task['date_started']),
            'date_started_not_defined' => empty($task['date_started']),
            'date_due_not_defined' => empty($task['date_due']),
            'dependencies' => $task['dependencies'] ?? [],
        );
    }
}

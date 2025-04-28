<?php

namespace Kanboard\Model;

use Kanboard\Core\Base;

class TaskDependencyModel extends Base
{
    const TABLE = 'task_dependencies';

    public function addDependency($taskId, $dependentTaskId)
    {
        $result = $this->db->table(self::TABLE)->insert([
            'task_id' => $taskId,
            'dependent_task_id' => $dependentTaskId,
        ]);

        if ($result) {
            // Fetch the parent task's due date
            $parentTask = $this->taskFinderModel->getById($dependentTaskId);

            // Fetch the dependent task
            $dependentTask = $this->taskFinderModel->getById($taskId);

            // Adjust the dependent task's start date if necessary
            if (!empty($parentTask['date_due']) && $parentTask['date_due'] > $dependentTask['date_started']) {
                $this->db->table(TaskModel::TABLE)
                    ->eq('id', $taskId)
                    ->update([
                        'date_started' => $parentTask['date_due'] + 86400, // Start the next day
                    ]);
            }
        }

        return $result;
    }

    public function getDependencies($taskId)
    {
        return $this->db->table(self::TABLE)
            ->columns('dependent_task_id')
            ->eq('task_id', $taskId)
            ->findAll();
    }

    public function hasCircularDependency($taskId, $dependentTaskId)
    {
        $dependencies = $this->getDependencies($dependentTaskId);

        foreach ($dependencies as $dependency) {
            if ($dependency['dependent_task_id'] == $taskId || $this->hasCircularDependency($taskId, $dependency['dependent_task_id'])) {
                return true;
            }
        }

        return false;
    }
}

<?php

namespace App\Schema;

class Task
{
    public function getSchema()
    {
        return array(
            'tasks' => array(
                'id' => 'integer',
                'title' => 'string',
                'description' => 'text',
                'date_creation' => 'integer',
                'date_completed' => 'integer',
                'date_started' => 'integer',
                'date_due' => 'integer',
                'color_id' => 'string',
                'project_id' => 'integer',
                'column_id' => 'integer',
                'owner_id' => 'integer',
                'creator_id' => 'integer',
                'position' => 'integer',
                'is_active' => 'integer',
                'score' => 'integer',
                'category_id' => 'integer',
                'swimlane_id' => 'integer',
                'date_moved' => 'integer',
                'recurrence_status' => 'integer',
                'recurrence_trigger' => 'integer',
                'recurrence_factor' => 'integer',
                'recurrence_timeframe' => 'integer',
                'recurrence_basedate' => 'integer',
                'recurrence_parent' => 'integer',
                'recurrence_child' => 'integer',
                'sprint_id' => 'integer',
            ),
        );
    }
} 
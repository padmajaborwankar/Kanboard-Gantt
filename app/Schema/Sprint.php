<?php

namespace App\Schema;

class Sprint
{
    public function getSchema()
    {
        return array(
            'sprints' => array(
                'id' => 'integer',
                'name' => 'string',
                'project_id' => 'integer',
                'start_date' => 'integer',
                'end_date' => 'integer',
            ),
        );
    }
} 
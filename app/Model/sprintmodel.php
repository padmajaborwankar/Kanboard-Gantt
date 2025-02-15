<?php

namespace Kanboard\Model;

use Kanboard\Core\Base;

class SprintModel extends Base
{
    const TABLE = 'sprints';

    public function getAllByProject($project_id)
    {
        return $this->db->table(self::TABLE)->eq('project_id', $project_id)->asc('id')->findAll();
    }

    public function create(array $values)
    {
        return $this->db->table(self::TABLE)->persist($values);
    }
    
    public function getAllSprintsForProjectList($project_id, $unassigned = true, $everybody = false)
{
    // Fetch all sprints for the given project
    $sprints = $this->sprintModel->getAllByProject($project_id);

    // If there is only one sprint, return it immediately
    if (count($sprints) === 1) {
        return $sprints;
    }

    // Add "Unassigned" option if needed
    if ($unassigned) {
        $sprints = array(t('Unassigned')) + $sprints;
    }

    // Add "Everybody" option if needed
    if ($everybody) {
        $sprints = array(SprintModel::EVERYBODY_ID => t('Everybody')) + $sprints;
    }

    return $sprints;
}

}

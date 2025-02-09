<div class="page-header">
    <h2><?= t('Edit a sub-task') ?></h2>
</div>

<form method="post" action="<?= $this->url->href('SubtaskController', 'update', array('task_id' => $task['id'], 'subtask_id' => $subtask['id'])) ?>" autocomplete="off">
    <?= $this->form->csrf() ?>

    <?= $this->subtask->renderTitleField($values, $errors, array('autofocus')) ?>
    <?= $this->subtask->renderAssigneeField($users_list, $values, $errors) ?>
    <?= $this->subtask->renderTimeEstimatedField($values, $errors) ?>
    <?= $this->subtask->renderTimeSpentField($values, $errors) ?>
    <div class="form-group">
        <?= $this->form->label(t('Start Date'), 'start_date') ?>
        <?= $this->form->text('start_date', $values, $errors, array('type' => 'date')) ?>
    </div>

    <div class="form-group">
        <?= $this->form->label(t('Due Date'), 'due_date') ?>
        <?= $this->form->text('due_date', $values, $errors, array('type' => 'date')) ?>
    </div>

    <?= $this->hook->render('template:subtask:form:edit', array('values' => $values, 'errors' => $errors)) ?>

    <?= $this->modal->submitButtons() ?>
</form>

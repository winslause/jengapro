<?php
require_once __DIR__ . '/../db.php';
header('Content-Type: application/json');

requireLogin();

$method = $_SERVER['REQUEST_METHOD'];
$entity = $_GET['entity'] ?? '';
$id = isset($_GET['id']) ? (int)$_GET['id'] : null;

// Field definitions per entity: columns that are writable
$entities = [
    'materials' => [
        'fields' => ['name','unit','delivery_date','depletion_date','low_stock_threshold'],
        'types'  => ['name'=>'str','unit'=>'str','delivery_date'=>'date','depletion_date'=>'date','low_stock_threshold'=>'int'],
    ],
    'workers' => [
        'fields' => ['name','worker_type','daily_rate'],
        'types'  => ['name'=>'str','worker_type'=>'str','daily_rate'=>'dec'],
    ],
    'payments' => [
        'fields' => ['payment_date','description','category','worker_type','worker_id','amount','recipient','status','week_start'],
        'types'  => ['payment_date'=>'date','description'=>'str','category'=>'str','worker_type'=>'strnull','worker_id'=>'intnull','amount'=>'dec','recipient'=>'str','status'=>'str','week_start'=>'datenull'],
    ],
    'progress' => [
        'fields' => ['progress_date','milestone','percentage','notes'],
        'types'  => ['progress_date'=>'date','milestone'=>'str','percentage'=>'int','notes'=>'str'],
    ],
    'weather' => [
        'fields' => ['weather_date','condition','temperature','effect'],
        'types'  => ['weather_date'=>'date','condition'=>'str','temperature'=>'dec','effect'=>'str'],
    ],
    'units' => [
        'fields' => ['name','symbol'],
        'types'  => ['name'=>'str','symbol'=>'str'],
    ],
];

if (!isset($entities[$entity])) {
    apiResponse(false, 'Unknown entity.');
}
$def = $entities[$entity];

function castValue($value, $type) {
    if ($value === null || $value === '') {
        return $type === 'strnull' || $type === 'intnull' ? null : '';
    }
    switch ($type) {
        case 'int': case 'intnull': return (int)$value;
        case 'dec': return (float)$value;
        case 'date':
            return preg_match('/^\d{4}-\d{2}-\d{2}$/', $value) ? $value : date('Y-m-d', strtotime($value));
        case 'datenull':
            if ($value === null || $value === '') return null;
            return preg_match('/^\d{4}-\d{2}-\d{2}$/', $value) ? $value : date('Y-m-d', strtotime($value));
        default: return (string)$value;
    }
}

// Record a material delivery (addition) and keep the running total in sync.
// $replaceAll=true means this is the only delivery for the material (edit scenario
// where quantity_delivered is the authoritative total for its delivery date).
function recordMaterialAddition($pdo, $materialId, $qty, $date, $replaceAll = false) {
    if ($qty <= 0) return;
    $date = $date ?: date('Y-m-d');
    if ($replaceAll) {
        $pdo->prepare("DELETE FROM material_additions WHERE material_id = ?")->execute([$materialId]);
    }
    $pdo->prepare("INSERT INTO material_additions (material_id, add_date, quantity_added) VALUES (?, ?, ?)")
        ->execute([$materialId, $date, $qty]);
    $pdo->prepare("UPDATE materials SET quantity_delivered = (SELECT COALESCE(SUM(quantity_added),0) FROM material_additions WHERE material_id = ?) WHERE id = ?")
        ->execute([$materialId, $materialId]);
}

// GET (list or single)
if ($method === 'GET') {
    if ($id) {
        $stmt = $pdo->prepare("SELECT * FROM `$entity` WHERE id = ?");
        $stmt->execute([$id]);
        $row = $stmt->fetch();
        if (!$row) apiResponse(false, 'Record not found.');
        apiResponse(true, '', ['data' => $row]);
    }
    $stmt = $pdo->prepare("SELECT * FROM `$entity` ORDER BY id DESC");
    $stmt->execute();
    apiResponse(true, '', ['data' => $stmt->fetchAll()]);
}

// POST (create)
if ($method === 'POST') {
    $data = getJsonInput();
    $cols = []; $vals = []; $params = [];
    foreach ($def['fields'] as $f) {
        $cols[] = "`$f`";
        $vals[] = '?';
        $params[] = castValue($data[$f] ?? null, $def['types'][$f]);
    }
    $sql = "INSERT INTO `$entity` (" . implode(',', $cols) . ") VALUES (" . implode(',', $vals) . ")";
    $stmt = $pdo->prepare($sql);
    $stmt->execute($params);
    $newId = $pdo->lastInsertId();

    // For materials: the "Qty Delivered (Added)" becomes the first delivery record.
    if ($entity === 'materials') {
        $qty = (float)($data['quantity_delivered'] ?? 0);
        $date = $data['delivery_date'] ?? null;
        if ($qty > 0) recordMaterialAddition($pdo, $newId, $qty, $date, true);
    }

    apiResponse(true, ucfirst($entity) . ' added successfully.', ['id' => $newId]);
}

// PUT (update)
if ($method === 'PUT') {
    if (!$id) apiResponse(false, 'ID required for update.');
    $data = getJsonInput();
    $sets = []; $params = [];
    foreach ($def['fields'] as $f) {
        if (array_key_exists($f, $data)) {
            $sets[] = "$f = ?";
            $params[] = castValue($data[$f], $def['types'][$f]);
        }
    }
    if (empty($sets)) apiResponse(false, 'No fields to update.');
    $params[] = $id;
    $sql = "UPDATE `$entity` SET " . implode(', ', $sets) . " WHERE id = ?";
    $stmt = $pdo->prepare($sql);
    $stmt->execute($params);

    // For materials: if quantity_delivered was provided, append it as a new delivery
    // (adding more stock) on the given date, increasing the running total.
    if ($entity === 'materials' && array_key_exists('quantity_delivered', $data)) {
        $qty = (float)$data['quantity_delivered'];
        $date = $data['delivery_date'] ?? null;
        recordMaterialAddition($pdo, $id, $qty, $date, false);
    }

    apiResponse(true, ucfirst($entity) . ' updated successfully.');
}

// DELETE
if ($method === 'DELETE') {
    if (!$id) apiResponse(false, 'ID required for delete.');
    $stmt = $pdo->prepare("DELETE FROM `$entity` WHERE id = ?");
    $stmt->execute([$id]);
    apiResponse(true, ucfirst($entity) . ' deleted successfully.');
}

apiResponse(false, 'Unsupported request.');

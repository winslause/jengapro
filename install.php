<?php
require_once 'db.php';

$sql = "
CREATE TABLE IF NOT EXISTS users (
    id INT AUTO_INCREMENT PRIMARY KEY,
    username VARCHAR(50) NOT NULL UNIQUE,
    password VARCHAR(255) NOT NULL,
    full_name VARCHAR(120) DEFAULT NULL,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;

CREATE TABLE IF NOT EXISTS materials (
    id INT AUTO_INCREMENT PRIMARY KEY,
    name VARCHAR(150) NOT NULL,
    unit VARCHAR(30) NOT NULL DEFAULT 'pieces',
    quantity_delivered INT NOT NULL DEFAULT 0,
    quantity_used INT NOT NULL DEFAULT 0,
    delivery_date DATE DEFAULT NULL,
    depletion_date DATE DEFAULT NULL,
    low_stock_threshold INT NOT NULL DEFAULT 0,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;

CREATE TABLE IF NOT EXISTS material_usage (
    id INT AUTO_INCREMENT PRIMARY KEY,
    material_id INT NOT NULL,
    use_date DATE NOT NULL,
    quantity_used DECIMAL(12,2) NOT NULL DEFAULT 0,
    note VARCHAR(200) DEFAULT NULL,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    FOREIGN KEY (material_id) REFERENCES materials(id) ON DELETE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;

CREATE TABLE IF NOT EXISTS workers (
    id INT AUTO_INCREMENT PRIMARY KEY,
    name VARCHAR(150) NOT NULL,
    worker_type ENUM('fundi','casual') NOT NULL DEFAULT 'casual',
    daily_rate DECIMAL(10,2) NOT NULL DEFAULT 0,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;

CREATE TABLE IF NOT EXISTS attendance (
    id INT AUTO_INCREMENT PRIMARY KEY,
    worker_id INT NOT NULL,
    work_date DATE NOT NULL,
    present TINYINT(1) NOT NULL DEFAULT 1,
    UNIQUE KEY uniq_worker_date (worker_id, work_date),
    FOREIGN KEY (worker_id) REFERENCES workers(id) ON DELETE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;

CREATE TABLE IF NOT EXISTS payments (
    id INT AUTO_INCREMENT PRIMARY KEY,
    payment_date DATE NOT NULL,
    description VARCHAR(200) NOT NULL,
    category ENUM('wage','other') NOT NULL DEFAULT 'wage',
    worker_type VARCHAR(30) DEFAULT NULL,
    worker_id INT DEFAULT NULL,
    amount DECIMAL(12,2) NOT NULL DEFAULT 0,
    recipient VARCHAR(150) NOT NULL,
    status ENUM('paid','pending','cancelled') NOT NULL DEFAULT 'pending',
    week_start DATE DEFAULT NULL,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
    FOREIGN KEY (worker_id) REFERENCES workers(id) ON DELETE SET NULL
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;

CREATE TABLE IF NOT EXISTS paid_weeks (
    id INT AUTO_INCREMENT PRIMARY KEY,
    worker_id INT NOT NULL,
    week_start DATE NOT NULL,
    paid_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    UNIQUE KEY uniq_worker_week (worker_id, week_start),
    FOREIGN KEY (worker_id) REFERENCES workers(id) ON DELETE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;

CREATE TABLE IF NOT EXISTS progress (
    id INT AUTO_INCREMENT PRIMARY KEY,
    progress_date DATE NOT NULL,
    milestone ENUM('foundation','structure','roofing','finishing') NOT NULL,
    percentage TINYINT NOT NULL DEFAULT 0,
    notes TEXT,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;

CREATE TABLE IF NOT EXISTS weather (
    id INT AUTO_INCREMENT PRIMARY KEY,
    weather_date DATE NOT NULL,
    `condition` ENUM('sunny','partly_cloudy','cloudy','rainy','stormy','windy') NOT NULL DEFAULT 'sunny',
    temperature DECIMAL(5,2) DEFAULT NULL,
    effect TEXT,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;
";

try {
    $pdo->exec($sql);

    // Seed default admin user (admin / admin123) if none exists
    $stmt = $pdo->prepare("SELECT COUNT(*) AS c FROM users");
    $stmt->execute();
    if ($stmt->fetch()['c'] == 0) {
        $pdo->prepare("INSERT INTO users (username, password, full_name) VALUES (?, ?, ?)")
            ->execute(['admin', password_hash('admin123', PASSWORD_DEFAULT), 'Site Manager']);
    }

    // Seed sample materials
    $stmt = $pdo->prepare("SELECT COUNT(*) AS c FROM materials");
    $stmt->execute();
    if ($stmt->fetch()['c'] == 0) {
        $samples = [
            ['Cement (50kg bags)', 'bags', 100, date('Y-m-d', strtotime('-10 days')), date('Y-m-d', strtotime('+12 days')), 20],
            ['Steel Bars (8mm)', 'pieces', 200, date('Y-m-d', strtotime('-12 days')), date('Y-m-d', strtotime('+10 days')), 40],
            ['Sand (cu.m)', 'cu.m', 50, date('Y-m-d', strtotime('-14 days')), date('Y-m-d', strtotime('+7 days')), 10],
        ];
        $ins = $pdo->prepare("INSERT INTO materials (name, unit, quantity_delivered, delivery_date, depletion_date, low_stock_threshold) VALUES (?,?,?,?,?,?)");
        foreach ($samples as $s) { $ins->execute($s); }
        // Seed an addition (delivery) for each sample so the system has "added" history.
        $ids = $pdo->query("SELECT id, delivery_date, quantity_delivered FROM materials ORDER BY id DESC LIMIT 3");
        $addIns = $pdo->prepare("INSERT INTO material_additions (material_id, add_date, quantity_added) VALUES (?, ?, ?)");
        foreach ($ids->fetchAll() as $m) {
            $addIns->execute([$m['id'], $m['delivery_date'] ?: date('Y-m-d'), $m['quantity_delivered']]);
        }
    }

    // Migrations for existing databases (safe to re-run)
    $cols = $pdo->query("SHOW COLUMNS FROM payments")->fetchAll(PDO::FETCH_COLUMN);
    if (!in_array('category', $cols)) {
        $pdo->exec("ALTER TABLE payments ADD COLUMN category ENUM('wage','other') NOT NULL DEFAULT 'wage' AFTER description");
    }
    if (!in_array('week_start', $cols)) {
        $pdo->exec("ALTER TABLE payments ADD COLUMN week_start DATE DEFAULT NULL AFTER status");
    }
    $pdo->exec("CREATE TABLE IF NOT EXISTS paid_weeks (
        id INT AUTO_INCREMENT PRIMARY KEY,
        worker_id INT NOT NULL,
        week_start DATE NOT NULL,
        paid_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
        UNIQUE KEY uniq_worker_week (worker_id, week_start),
        FOREIGN KEY (worker_id) REFERENCES workers(id) ON DELETE CASCADE
    ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4");

    $mcols = $pdo->query("SHOW COLUMNS FROM materials")->fetchAll(PDO::FETCH_COLUMN);
    if (!in_array('low_stock_threshold', $mcols)) {
        $pdo->exec("ALTER TABLE materials ADD COLUMN low_stock_threshold INT NOT NULL DEFAULT 0 AFTER depletion_date");
    }
    $pdo->exec("CREATE TABLE IF NOT EXISTS material_usage (
        id INT AUTO_INCREMENT PRIMARY KEY,
        material_id INT NOT NULL,
        use_date DATE NOT NULL,
        quantity_used DECIMAL(12,2) NOT NULL DEFAULT 0,
        note VARCHAR(200) DEFAULT NULL,
        created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
        FOREIGN KEY (material_id) REFERENCES materials(id) ON DELETE CASCADE
    ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4");

    // Material additions (deliveries). Tracks each batch of material added, so the
    // system can report how much was added in a day / week. quantity_delivered on the
    // materials table is kept in sync as the running total added.
    $pdo->exec("CREATE TABLE IF NOT EXISTS material_additions (
        id INT AUTO_INCREMENT PRIMARY KEY,
        material_id INT NOT NULL,
        add_date DATE NOT NULL,
        quantity_added DECIMAL(12,2) NOT NULL DEFAULT 0,
        note VARCHAR(200) DEFAULT NULL,
        created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
        FOREIGN KEY (material_id) REFERENCES materials(id) ON DELETE CASCADE
    ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4");

    // Migrate any existing quantity_delivered (legacy single delivery) into additions.
    $migrate = $pdo->query("SELECT id, quantity_delivered, delivery_date FROM materials WHERE quantity_delivered > 0");
    $addIns = $pdo->prepare("INSERT INTO material_additions (material_id, add_date, quantity_added) VALUES (?, ?, ?)");
    $chk = $pdo->prepare("SELECT COUNT(*) AS c FROM material_additions WHERE material_id = ?");
    foreach ($migrate->fetchAll() as $m) {
        $chk->execute([$m['id']]);
        if ($chk->fetch()['c'] == 0) {
            $d = $m['delivery_date'] ?: date('Y-m-d');
            $addIns->execute([$m['id'], $d, $m['quantity_delivered']]);
        }
    }
    // Backfill any legacy quantity_used into material_usage so totals stay correct.
    $uChk = $pdo->prepare("SELECT COUNT(*) AS c FROM material_usage WHERE material_id = ?");
    $uIns = $pdo->prepare("INSERT INTO material_usage (material_id, use_date, quantity_used, note) VALUES (?, ?, ?, 'Migrated legacy usage')");
    foreach ($pdo->query("SELECT id, quantity_used, delivery_date FROM materials WHERE quantity_used > 0")->fetchAll() as $m) {
        $uChk->execute([$m['id']]);
        if ($uChk->fetch()['c'] == 0 && $m['quantity_used'] > 0) {
            $uIns->execute([$m['id'], date('Y-m-d'), $m['quantity_used']]);
        }
    }

    // Manageable units list.
    $pdo->exec("CREATE TABLE IF NOT EXISTS units (
        id INT AUTO_INCREMENT PRIMARY KEY,
        name VARCHAR(40) NOT NULL UNIQUE,
        symbol VARCHAR(20) DEFAULT NULL,
        created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
    ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4");

    $ucount = $pdo->query("SELECT COUNT(*) AS c FROM units")->fetch()['c'];
    if ($ucount == 0) {
        $uins = $pdo->prepare("INSERT INTO units (name, symbol) VALUES (?, ?)");
        foreach ([
            ['bags','bags'],['pieces','pcs'],['kg','kg'],['tons','t'],
            ['liters','L'],['cu.m','m³'],['meters','m'],['rolls','rolls'],['units','u']
        ] as $u) { $uins->execute($u); }
    }

    echo "Database 'jengapro' installed successfully.<br>Default login: <b>admin / admin123</b>";
} catch (PDOException $e) {
    http_response_code(500);
    echo "Install failed: " . $e->getMessage();
}

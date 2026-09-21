-- Seed user untuk QA lokal test-session-recorder.
-- Tabel `user` adalah tabel existing aplikasi; di sini dibuat ulang khusus
-- untuk database QA lokal (qa_recorder), bukan migration produksi.

CREATE TABLE IF NOT EXISTS `user` (
	`id_user` INT UNSIGNED NOT NULL AUTO_INCREMENT,
	`nama` VARCHAR(150) NOT NULL,
	`username` VARCHAR(100) NOT NULL,
	`password` VARCHAR(255) NOT NULL,
	`level` VARCHAR(50) NOT NULL DEFAULT 'IMPLEMENTOR',
	`aktif` TINYINT(1) NOT NULL DEFAULT 1,
	`status_login` VARCHAR(20) NOT NULL DEFAULT 'FREE',
	`ip_addres` VARCHAR(100) NULL,
	`hint_password` VARCHAR(255) NULL,
	PRIMARY KEY (`id_user`),
	UNIQUE KEY `uq_user_username` (`username`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

INSERT INTO `user` (`nama`, `username`, `password`, `level`, `aktif`)
VALUES
	('QA Admin', 'qaadmin', md5('qaadmin123'), 'QA', 1),
	('QA Tester', 'qatester', md5('qatester123'), 'IMPLEMENTOR', 1)
ON DUPLICATE KEY UPDATE
	`level` = VALUES(`level`),
	`aktif` = VALUES(`aktif`);

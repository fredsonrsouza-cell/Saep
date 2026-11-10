-- SAEPVision - estrutura física do banco de dados
CREATE DATABASE IF NOT EXISTS saepvision CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;
USE saepvision;

DROP TABLE IF EXISTS curtidas;
DROP TABLE IF EXISTS publicacoes;
DROP TABLE IF EXISTS usuarios;

CREATE TABLE usuarios (
  id INT AUTO_INCREMENT PRIMARY KEY,
  nome VARCHAR(100) NOT NULL,
  usuario VARCHAR(50) NOT NULL UNIQUE,          -- handle: fotografo1 (exibido como @fotografo1)
  email VARCHAR(120) NOT NULL UNIQUE,
  senha VARCHAR(64) NOT NULL,                    -- SHA-256 em hexadecimal
  tipo ENUM('comum','fotografo') NOT NULL DEFAULT 'comum',
  foto VARCHAR(255) NOT NULL DEFAULT 'assets/perfis/saepvision.jpg'
) ENGINE=InnoDB;

CREATE TABLE publicacoes (
  id INT AUTO_INCREMENT PRIMARY KEY,
  usuario_id INT NOT NULL,                       -- somente fotógrafos publicam
  titulo VARCHAR(120) NOT NULL,
  local VARCHAR(120) NOT NULL,
  imagem VARCHAR(255) NOT NULL,
  criado_em TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  FOREIGN KEY (usuario_id) REFERENCES usuarios(id) ON DELETE CASCADE
) ENGINE=InnoDB;

CREATE TABLE curtidas (
  id INT AUTO_INCREMENT PRIMARY KEY,
  usuario_id INT NOT NULL,
  publicacao_id INT NOT NULL,
  UNIQUE KEY uq_curtida (usuario_id, publicacao_id),   -- máximo de 1 curtida por publicação
  FOREIGN KEY (usuario_id) REFERENCES usuarios(id) ON DELETE CASCADE,
  FOREIGN KEY (publicacao_id) REFERENCES publicacoes(id) ON DELETE CASCADE
) ENGINE=InnoDB;

-- Dados de exemplo (senha de todos: 123456)
INSERT INTO usuarios (nome, usuario, email, senha, tipo, foto) VALUES
('Fotógrafo Um',   'fotografo1', 'fotografo1@saepvision.com', SHA2('123456',256), 'fotografo', 'assets/perfis/fotografo1.jpg'),
('Fotógrafo Dois', 'fotografo2', 'fotografo2@saepvision.com', SHA2('123456',256), 'fotografo', 'assets/perfis/fotografo2.jpg'),
('Fotógrafo Três', 'fotografo3', 'fotografo3@saepvision.com', SHA2('123456',256), 'fotografo', 'assets/perfis/fotografo3.jpg'),
('Usuário Um',     'usuario1',   'usuario1@saepvision.com',   SHA2('123456',256), 'comum',     'assets/perfis/usuario1.jpg'),
('Usuário Dois',   'usuario2',   'usuario2@saepvision.com',   SHA2('123456',256), 'comum',     'assets/perfis/usuario2.jpg'),
('Usuário Três',   'usuario3',   'usuario3@saepvision.com',   SHA2('123456',256), 'comum',     'assets/perfis/usuario3.jpg');

INSERT INTO publicacoes (usuario_id, titulo, local, imagem) VALUES
(1,'Cidade ao anoitecer','Bangkok, Tailândia','uploads/foto1.jpg'),
(1,'Cachoeira ao pôr do sol','Seljalandsfoss, Islândia','uploads/foto2.jpg'),
(1,'Montanhas ao amanhecer','Annapurna, Nepal','uploads/foto3.jpg'),
(2,'Casa na montanha','Arnarstapi, Islândia','uploads/foto4.jpg'),
(2,'Campo dourado','Serra Nevada, EUA','uploads/foto5.jpg'),
(2,'Lago na floresta','Lago di Braies, Itália','uploads/foto6.jpg'),
(3,'Lua sobre as montanhas','Montanhas','uploads/foto7.jpg'),
(3,'Centro da cidade','Saint Paul, EUA','uploads/foto8.jpg'),
(3,'Luz na floresta','Floresta de pinheiros','uploads/foto9.jpg');

INSERT INTO curtidas (usuario_id, publicacao_id) VALUES (4,1),(5,1),(4,4),(5,7),(6,7);

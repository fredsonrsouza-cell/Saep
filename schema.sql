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
  foto VARCHAR(255) NOT NULL DEFAULT 'assets/avatar.svg'
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

-- Dados de exemplo (senha de todos: 123456). Substitua/importe os dados do usuarios.csv conforme as colunas dele.
INSERT INTO usuarios (nome, usuario, email, senha, tipo) VALUES
('Fotógrafo Um',   'fotografo1', 'fotografo1@saepvision.com', SHA2('123456',256), 'fotografo'),
('Fotógrafo Dois', 'fotografo2', 'fotografo2@saepvision.com', SHA2('123456',256), 'fotografo'),
('Usuário Comum',  'comum1',     'comum1@saepvision.com',     SHA2('123456',256), 'comum');

INSERT INTO publicacoes (usuario_id, titulo, local, imagem) VALUES
(1,'Foto 1','Rio de Janeiro','uploads/foto1.svg'),
(1,'Foto 2','Salvador','uploads/foto2.svg'),
(1,'Foto 3','São Paulo','uploads/foto3.svg'),
(2,'Foto 4','Recife','uploads/foto4.svg'),
(2,'Foto 5','Florianópolis','uploads/foto5.svg'),
(2,'Foto 6','Brasília','uploads/foto6.svg');

INSERT INTO curtidas (usuario_id, publicacao_id) VALUES (3,1),(2,1),(3,4);

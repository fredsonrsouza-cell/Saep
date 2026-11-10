-- Remove as publicações de exemplo (sem foto) sem precisar reimportar o banco inteiro
USE saepvision;
DELETE FROM publicacoes WHERE imagem LIKE 'uploads/foto_.svg';

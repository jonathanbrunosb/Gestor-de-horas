-- Adiciona hora inicial/final e horas compensadas à folga, para sinalizar
-- quantas horas o colaborador fica ausente naquele dia (usado no formulário
-- "Nova folga"). Idempotente — seguro colar mais de uma vez no SQL Editor.

alter table leaves add column if not exists start_time text;
alter table leaves add column if not exists end_time text;
alter table leaves add column if not exists compensated_minutes integer not null default 0;

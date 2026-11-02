# Резервная копия базы «Задачник SRM»

Каждую ночь (03:00 по Саратову) GitHub выгружает таблицы базы, шифрует паролем и хранит 30 дней:
репозиторий → Actions → «Резервная копия базы» → нужный запуск → файл zadachnik-backup-N.
Без вашего пароля шифрования файл прочитать нельзя (репозиторий публичный — поэтому шифруем).

## Один раз настроить (секреты)
GitHub → репозиторий zadachnik → Settings → Secrets and variables → Actions → New repository secret:
1. `SUPABASE_DB_URL` — строка подключения: Supabase → проект «Задачник CRM» → Connect → Session pooler (URI),
   вместо [YOUR-PASSWORD] — пароль базы (если не помните: Project Settings → Database → Reset database password).
2. `BACKUP_PASSPHRASE` — любой ваш пароль для шифрования копий. Запишите его — без него копия бесполезна.
Проверка: Actions → «Резервная копия базы» → Run workflow → через минуту зелёная галочка.

## Восстановить
gpg -d zadachnik-ГГГГ-ММ-ДД.dump.gpg > db.dump
pg_restore --clean --if-exists --no-owner -d "<строка подключения>" db.dump

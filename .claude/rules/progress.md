# Правила отслеживания прогресса

Каждая задача должна иметь свой файл состояния `progress/{TASK-SLUG}.md`.

## Шаблон файла задачи (Используется Планнером при создании)
```markdown
Status: DESIGNED
Tech Design: —
Code: —

## Карточка задачи
- [ ] Product requirements (planner)
- [ ] Technical design (planner)
- [ ] QA tests (qa-lead)
- [ ] Implementation (engineer)
- [ ] Architecture review (tech-lead)

## Log
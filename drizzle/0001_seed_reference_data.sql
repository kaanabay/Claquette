-- Reference data every environment needs. Idempotent, so it is safe to re-run.
-- New media types can be added later with a plain INSERT (manual entry works immediately).
INSERT INTO "media_types" ("slug", "label", "icon", "creator_label", "sort_order") VALUES
  ('book', 'Kitap', '📚', 'Yazar', 1),
  ('movie', 'Film', '🎬', 'Yönetmen', 2),
  ('tv', 'Dizi', '📺', 'Yaratıcı', 3),
  ('podcast', 'Podcast', '🎧', 'Yapımcı', 4),
  ('game', 'Oyun', '🎮', 'Stüdyo', 5),
  ('other', 'Diğer', '✨', 'Yaratıcı', 6)
ON CONFLICT ("slug") DO NOTHING;
--> statement-breakpoint
-- The system workflow used by every new challenge. Groups can define their own workflows
-- (workflows.group_id) with extra steps; the engine only relies on the state categories.
WITH wf AS (
  INSERT INTO "workflows" ("key", "name", "description")
  VALUES ('default', 'Varsayılan akış', 'Önerildi → Kabul Edildi → Tamamlandı (ya da Reddedildi)')
  ON CONFLICT ("key") DO NOTHING
  RETURNING "id"
)
INSERT INTO "workflow_states" ("workflow_id", "key", "label", "category", "color", "position")
SELECT wf."id", s."key", s."label", s."category"::"state_category", s."color", s."position"
FROM wf
CROSS JOIN (VALUES
  ('suggested', 'Önerildi', 'pending', 'amber', 1),
  ('accepted', 'Kabul Edildi', 'active', 'sky', 2),
  ('completed', 'Tamamlandı', 'done', 'emerald', 3),
  ('rejected', 'Reddedildi', 'dropped', 'rose', 4)
) AS s("key", "label", "category", "color", "position");

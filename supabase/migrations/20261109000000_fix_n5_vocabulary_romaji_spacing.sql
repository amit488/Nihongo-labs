-- Restore learner-friendly word boundaries in the three N5 vocabulary examples
-- reported in the vocabulary cards. Keep the seed file and existing databases in sync.

update public.vocabulary_entries
set example_reading = case word
  when 'あの' then 'ano oishii wain o naze nomanai n dai.'
  when 'アパート' then 'ani wa apaato o sagashite imasu.'
  when 'あびる' then 'sono toki wa shawaa o abite ita.'
end,
updated_at = now()
where jlpt_level = 'N5'
  and (
    (word = 'あの' and example_sentence = 'あのおいしいワインをなぜ飲まないんだい。')
    or (word = 'アパート' and example_sentence = '兄はアパートをさがしています。')
    or (word = 'あびる' and example_sentence = 'その時はシャワーを浴びていた。')
  );

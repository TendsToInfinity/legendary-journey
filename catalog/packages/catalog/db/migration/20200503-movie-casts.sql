-- Reduce cast members of existing movies and tv episodes to 5

UPDATE product
SET document = jsonb_set(document, '{meta, cast}', to_jsonb(
	array_remove((ARRAY[
		document #> '{meta, cast}' -> 0,
		document #> '{meta, cast}' -> 1,
		document #> '{meta, cast}' -> 2,
		document #> '{meta, cast}' -> 3,
		document #> '{meta, cast}' -> 4
	]), NULL)))
WHERE (document ->> 'productTypeId' = 'movie' OR document ->> 'productTypeId' = 'tvEpisode')
AND jsonb_array_length(document #> '{meta, cast}') > 5;

# Super tricky glue_sql formatting test case
# This combines multiple edge cases that could break the parser

test_query <- glue::glue_sql(
  "SELECT
      {col_name} AS result,
      {ifelse(use_upper, 'UPPER(name)', 'LOWER(name)')} AS transformed,
      {paste0('col_', 1:3, collapse = ', ')} AS cols,
      status_code,
      CASE
      WHEN flag = TRUE THEN {success_msg}
        WHEN flag = FALSE THEN {error_msg}
        ELSE 'unknown'
      END AS message,
      '{literal_with_fake_{interpolation}}' AS fake,
      ARRAY[{vals*}] AS arr,
      {'single''quoted''value'} AS single_q,
      {nested_func(list(a = '{inner_str}', b = 2))} AS nested
    FROM
      TABLE
    WHERE
      id IN ({ids*})
      AND created > {start_date}
      AND description LIKE '% {search_term} %'
      AND metadata ->> 'key' = {'some value with spaces'}
      AND array_length(tags, 1) > {min_tags}",
  .con = con,
  col_name = "id",
  use_upper = TRUE,
  success_msg = "Success!",
  error_msg = "Failed",
  vals = 1:5,
  ids = c(1, 2, 3),
  start_date = Sys.Date() - 30,
  search_term = "test",
  min_tags = 3
)

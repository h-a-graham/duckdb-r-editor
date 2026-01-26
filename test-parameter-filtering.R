# Test parameter filtering - which strings are treated as SQL?

library(DBI)
library(glue)

# Test 1: glue_sql - unnamed arguments (SQL) vs named arguments (not SQL)
query1 <- glue::glue_sql(
  "SELECT * FROM table",  # <- This SHOULD be treated as SQL (unnamed, goes to ...)
  .con = con              # <- This should NOT be treated as SQL (named with .)
)

# Test 2: glue_sql with multiple named arguments
query2 <- glue::glue_sql(
  "SELECT {col} FROM {table}",  # <- SQL
  .con = my_connection,          # <- NOT SQL
  .envir = parent.frame(),       # <- NOT SQL
  .na = "NULL"                   # <- NOT SQL
)

# Test 3: dbExecute - first argument is SQL
DBI::dbExecute(
  conn,
  "CREATE TABLE test (id INT)"  # <- This SHOULD be treated as SQL (first string arg)
)

# Test 4: dbExecute with named statement parameter
DBI::dbExecute(
  conn = my_conn,
  statement = "INSERT INTO test VALUES (1)"  # <- SQL (named "statement")
)

# Test 5: dbGetQuery with params (params should NOT be treated as SQL)
result <- dbGetQuery(
  conn,
  "SELECT * FROM test WHERE id = ?",  # <- SQL (first string)
  params = list(1)                     # <- NOT SQL (named params)
)

# Test 6: Edge case - string in params should NOT be SQL
result2 <- dbGetQuery(
  conn,
  "SELECT * FROM test",  # <- SQL
  params = "not sql"     # <- NOT SQL (named argument)
)

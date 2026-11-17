Feature: Search visible regular files by case-sensitive filename
  Scenario Outline: Exact search respects ignore and parent combinations
    Given an isolated directory with <ignore> selected ignore files
    And the parent mode is <parent>
    When I search for each fixture filename with where and <flags>
    Then only visible regular files with that basename appear in find order
    And empty parent accepts "", bare --parent, --parent --, and --parent before another option

    Examples:
      | ignore | flags | parent |
      | 0 | defaults | omitted |
      | 0 | defaults | empty |
      | 0 | defaults | explicit |
      | 1 | defaults | omitted |
      | 1 | defaults | empty |
      | 1 | defaults | explicit |
      | 2 | two ignore files | omitted |
      | 2 | two ignore files | empty |
      | 2 | two ignore files | explicit |
      | 2 | two files and --no-global-ignore | omitted |
      | 2 | two files and --no-global-ignore | empty |
      | 2 | two files and --no-global-ignore | explicit |
      | 2 | two files and --no-ignore | omitted |
      | 2 | two files and --no-ignore | empty |
      | 2 | two files and --no-ignore | explicit |

  Scenario: Exact, Contains, and Glob select basenames
    Given files with different case, extensions, hidden names, and nested paths
    When I use default, long, short, and repeated matching options
    Then only matching regular files appear as plain relative paths in walker order
    And no match writes nothing and succeeds

  Scenario: Ignore rules and file types
    Given ignored files, a directory, a symlink, and a symlinked directory
    When I search by basename
    Then ignored entries, directories, and links are excluded
    And --no-ignore can reveal the ignored regular file

  Scenario: Nested ignore and negation apply to Contains and Glob
    Given nested ignore rules that rescue one config filename
    When I search with Contains or Glob
    Then only the visible regular file appears
    And --no-ignore reveals all matching regular files

  Scenario: Parent collection and validation
    Given nested ancestor ignore files
    When I choose an ancestor with --parent
    Then output stays relative to the search root
    And unrelated parents or unforced parent-relative paths fail

  Scenario: Invalid arguments and filesystem failures
    When I omit the query, use an empty or path query, conflict modes, add positionals, or use an unknown option
    Then stdout is empty, stderr explains the error, and exit status is nonzero
    When the source is missing or is a file
    Then stdout is empty, stderr explains the filesystem error, and exit status is nonzero

  Scenario: Directory then query positions and option terminator
    Given visible filenames beginning with --
    When I pass only a query
    Then the current directory is searched
    When I pass a directory and then a query
    Then that directory is searched
    When I place -- before a leading dash query or after a bare --parent
    Then where searches for that literal filename with the existing parent semantics
    And --exact, --contains, --glob, and --help after -- stay literal queries
    And a query containing ../ fails query validation rather than source path validation
    When I request where --help
    Then usage, mode options, and scan options are displayed

  Scenario: Multiple TTY matches have uniform emphasis
    Given two visible regular files named AGENTS.md
    When I search by exact filename on a TTY
    Then neither result is styled as a heading

  Scenario: Stream filename matches
    Given multiple visible files matching a query
    When I run where
    Then each match is written before the next entry is requested

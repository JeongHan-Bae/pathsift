Feature: find command
  Scenario Outline: find respects ignore and parent combinations
    Given an isolated directory with <ignore files> ignore files
    And the global ignore rule is <global>
    And the parent mode is <parent>
    And empty parent accepts "", bare --parent, --parent --, and --parent before --force
    When I run find with <flags> and <parent>
    Then I receive every visible relative path

    Examples:
      | ignore files | global | flags | parent |
      | 0 | on | defaults | omitted |
      | 0 | on | defaults | empty |
      | 0 | on | defaults | explicit |
      | 1 | on | defaults | omitted |
      | 1 | on | defaults | empty |
      | 1 | on | defaults | explicit |
      | 2 | on | two --ignore-file options | omitted |
      | 2 | on | two --ignore-file options | empty |
      | 2 | on | two --ignore-file options | explicit |
      | 2 | off | --no-global-ignore | omitted |
      | 2 | off | --no-global-ignore | empty |
      | 2 | off | --no-global-ignore | explicit |
      | 2 | bypassed | --no-ignore | omitted |
      | 2 | bypassed | --no-ignore | empty |
      | 2 | bypassed | --no-ignore | explicit |

  Scenario: Parent-relative paths require force
    Given a relative path containing ..
    When I run find without --force
    Then stderr explains the required option and the command fails
    When I run find with --force
    Then the command succeeds

  Scenario: A .dockerignore name still uses Git-style scopes
    Given root and nested .dockerignore files
    When I select .dockerignore with --ignore-file
    Then the nested file is applied as a Git-style rule

  Scenario: Select ancestor ignore scopes
    Given a target below two ancestor directories with ignore files
    When I run find without --parent
    Then only the target's ignore file applies
    When I use the ancestor path or an empty --parent from that directory
    Then ignore files along the path to the target apply
    And two selected ignore filenames and disabled filtering retain their documented behavior
    And an unrelated parent or parent-relative path without --force fails on stderr
    And a bare --parent at the end, before --, or before another option acts like an empty value

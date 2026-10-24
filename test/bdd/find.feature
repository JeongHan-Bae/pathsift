Feature: find command
  Scenario Outline: find respects ignore combinations
    Given an isolated directory with <ignore files> ignore files
    And the global ignore rule is <global>
    When I run find with <flags>
    Then I receive every visible relative path

    Examples:
      | ignore files | global | flags |
      | 0 | on | defaults |
      | 1 | on | defaults |
      | 2 | on | two --ignore-file options |
      | 2 | off | --no-global-ignore |
      | 2 | bypassed | --no-ignore |

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

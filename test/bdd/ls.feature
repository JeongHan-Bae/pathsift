Feature: ls command
  Scenario Outline: ls respects ignore combinations
    Given an isolated directory with <ignore files> ignore files
    And the global ignore rule is <global>
    When I run ls with <flags>
    Then I receive root-level names

    Examples:
      | ignore files | global | flags |
      | 0 | on | defaults |
      | 1 | on | defaults |
      | 2 | on | two --ignore-file options |
      | 2 | off | --no-global-ignore |
      | 2 | bypassed | --no-ignore |

  Scenario: Parent-relative paths require force
    Given a relative path containing ..
    When I run ls without --force
    Then stderr explains the required option and the command fails
    When I run ls with --force
    Then the command succeeds

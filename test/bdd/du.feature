Feature: du command
  Scenario Outline: du respects ignore combinations
    Given an isolated directory with <ignore files> ignore files
    And the global ignore rule is <global>
    When I run du with <flags>
    Then I receive regular-file bytes

    Examples:
      | ignore files | global | flags |
      | 0 | on | defaults |
      | 1 | on | defaults |
      | 2 | on | two --ignore-file options |
      | 2 | off | --no-global-ignore |
      | 2 | bypassed | --no-ignore |

  Scenario: Parent-relative paths require force
    Given a relative path containing ..
    When I run du without --force
    Then stderr explains the required option and the command fails
    When I run du with --force
    Then the command succeeds

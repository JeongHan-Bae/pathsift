Feature: tree command
  Scenario Outline: tree respects ignore combinations
    Given an isolated directory with <ignore files> ignore files
    And the global ignore rule is <global>
    When I run tree with <flags>
    Then I receive a branch drawing and totals

    Examples:
      | ignore files | global | flags |
      | 0 | on | defaults |
      | 1 | on | defaults |
      | 2 | on | two --ignore-file options |
      | 2 | off | --no-global-ignore |
      | 2 | bypassed | --no-ignore |

  Scenario: Parent-relative paths require force
    Given a relative path containing ..
    When I run tree without --force
    Then stderr explains the required option and the command fails
    When I run tree with --force
    Then the command succeeds

  Scenario: Interactive tree output
    When I run tree on a TTY
    Then Ink renders the visible branches

  Scenario: Directories precede files at every level
    Given multiple directories and files created in mixed name order
    When I run tree
    Then each level lists name-sorted directories first and name-sorted files afterward

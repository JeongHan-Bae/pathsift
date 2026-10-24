Feature: archive command
  Scenario Outline: archive respects ignore combinations
    Given an isolated directory with <ignore files> ignore files
    And the global ignore rule is <global>
    When I run archive with <flags>
    Then I receive an archive containing only visible entries and preserved links

    Examples:
      | ignore files | global | flags |
      | 0 | on | defaults |
      | 1 | on | defaults |
      | 2 | on | two --ignore-file options |
      | 2 | off | --no-global-ignore |
      | 2 | bypassed | --no-ignore |

  Scenario: Parent-relative paths require force
    Given a relative path containing ..
    When I run archive without --force
    Then stderr explains the required option and the command fails
    When I run archive with --force
    Then the command succeeds

  Scenario: Archive into a missing child file
    Given c/a.tar does not exist
    When I run archive c/ c/a.tar
    Then the archive contains the visible source entries without a.tar

  Scenario: Archive into an empty child file
    Given c/a.tar exists and is empty
    When I run archive c/ c/a.tar
    Then the archive contains the visible source entries without a.tar

  Scenario: Reject a nonempty child file
    Given c/a.tar contains bytes
    When I run archive c/ c/a.tar
    Then the command fails before source traversal and leaves those bytes unchanged

  Scenario: Direct mode above the memory limit
    Given the visible file bytes exceed bufferLimitBytes
    When I run archive
    Then the archive contains the expected entries

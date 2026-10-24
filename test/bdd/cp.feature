Feature: cp command
  Scenario Outline: cp respects ignore combinations
    Given an isolated directory with <ignore files> ignore files
    And the global ignore rule is <global>
    When I run cp with <flags>
    Then I receive a new directory containing only visible entries and preserved links

    Examples:
      | ignore files | global | flags |
      | 0 | on | defaults |
      | 1 | on | defaults |
      | 2 | on | two --ignore-file options |
      | 2 | off | --no-global-ignore |
      | 2 | bypassed | --no-ignore |

  Scenario: Parent-relative paths require force
    Given a relative path containing ..
    When I run cp without --force
    Then stderr explains the required option and the command fails
    When I run cp with --force
    Then the command succeeds

  Scenario: Copy into a missing child directory
    Given c/a does not exist
    When I run cp c/ c/a/
    Then a contains the visible source files without an a/a copy

  Scenario: Copy into an empty child directory
    Given c/a exists and is empty
    When I run cp c/ c/a/
    Then a contains the visible source files without an a/a copy

  Scenario: Reject a nonempty child directory
    Given c/a contains a file
    When I run cp c/ c/a/
    Then the command fails before source traversal and leaves that file unchanged

  Scenario: Direct mode above the memory limit
    Given the visible file bytes exceed bufferLimitBytes
    When I run cp
    Then the copied destination has the expected content

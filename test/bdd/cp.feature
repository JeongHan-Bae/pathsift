Feature: cp command
  Scenario Outline: cp respects ignore and parent combinations
    Given an isolated directory with <ignore files> ignore files
    And the global ignore rule is <global>
    And the parent mode is <parent>
    And empty parent accepts "", bare --parent, --parent --, and --parent before --force
    When I run cp with <flags> and <parent>
    Then I receive a new directory containing only visible entries and preserved links

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

  Scenario: Copy with ancestor ignore scopes
    Given a target below two ancestor ignore files
    When I run cp without --parent, with its ancestor, and with an empty --parent from that ancestor
    Then each destination contains exactly its selected target-relative files
    And invalid parent paths fail without creating the destination

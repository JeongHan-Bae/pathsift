Feature: archive command
  Scenario Outline: archive respects ignore and parent combinations
    Given an isolated directory with <ignore files> ignore files
    And the global ignore rule is <global>
    And the parent mode is <parent>
    And empty parent accepts "", bare --parent, --parent --, and --parent before --force
    When I run archive with <flags> and <parent>
    Then I receive an archive containing only visible entries and preserved links

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

  Scenario: Archive with ancestor ignore scopes
    Given a target below two ancestor ignore files
    When I run archive without --parent, with its ancestor, and with an empty --parent from that ancestor
    Then each archive contains exactly its selected target-relative members
    And invalid parent paths fail without creating the archive

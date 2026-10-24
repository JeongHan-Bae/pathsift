Feature: du command
  Scenario Outline: du respects ignore and parent combinations
    Given an isolated directory with <ignore files> ignore files
    And the global ignore rule is <global>
    And the parent mode is <parent>
    And empty parent accepts "", bare --parent, --parent --, and --parent before --force
    When I run du with <flags> and <parent>
    Then I receive regular-file bytes

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
    When I run du without --force
    Then stderr explains the required option and the command fails
    When I run du with --force
    Then the command succeeds

  Scenario: Measure bytes with ancestor ignore scopes
    Given a target below two ancestor ignore files
    When I run du without --parent, with its ancestor, and with an empty --parent from that ancestor
    Then each byte total reflects the selected files
    And invalid parent paths fail on stderr

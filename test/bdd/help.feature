Feature: help and command dispatch
  Scenario: Equivalent help forms
    When I run with no command, help, and --help
    Then each prints the same usage and all command options

  Scenario: Invalid command or option
    When I provide an unknown command or malformed option
    Then the CLI reports an error on stderr and exits nonzero

  Scenario: Interactive help
    When I run help on a TTY
    Then Ink styles the document while redirected help remains plain

  Scenario: Reject help arguments and scan options
    When I run help with an extra path or --force
    Then stderr reports an argument or option error

Feature: help and command dispatch
  Scenario: Equivalent help forms
    When I run with no command, help, --help, and tree --parent with or without an empty value before --help
    Then each prints the same usage, parent-mode semantics, and all command options

  Scenario: Invalid command or option
    When I provide an unknown command or malformed option
    Then the CLI reports an error on stderr and exits nonzero

  Scenario: Interactive help
    When I run help on a TTY
    Then Ink styles the document while redirected help remains plain

  Scenario: Reject help arguments and scan options
    When I run help with an extra path, --force, or --parent with or without an empty value
    Then stderr reports an argument or option error

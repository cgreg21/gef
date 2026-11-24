<Flex direction="column" gap="14" margin-top="20">
  <GtkLabel label="Create an extension" xalign="0" />
  <GtkLabel label="Basic information" xalign="0" />
  <GtkLabel label="Extension name" xalign="0" />
  <GtkEntry placeholder-text="e.g. Workspace Navigator" />
  <GtkLabel label="Description" xalign="0" />
  <GtkEntry placeholder-text="What does your extension do?" />
  <GtkLabel label="Search a package" xalign="0" />
  <GtkSearchEntry placeholder-text="Search packages…" />
  <GtkLabel label="Credentials" xalign="0" />
  <GtkPasswordEntry placeholder-text="Access token" />
  <Flex direction="row" gap="8">
    <GtkButton label="Cancel" />
    <GtkButton label="Create extension" />
  </Flex>
</Flex>
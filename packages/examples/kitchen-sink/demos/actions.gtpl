<Flex direction="column" gap="16" margin-top="20">
  <GefSectionHeader title="Actions and feedback" description="Reusable GEF components compose with native GTK controls." />
  <Flex direction="row" gap="8">
    <GefButton label="Create extension" />
    <GefButton label="Preview" />
  </Flex>
  <GtkSeparator orientation="horizontal" />
  <GefLabel text="Destructive action" />
  <Flex direction="row" gap="8">
    <GefButton label="Remove extension" />
    <GefButton label="Cancel" />
  </Flex>
  <GefLabel text="Button groups can be composed with Flex and Grid." />
  <Grid columns="2" gap="8">
    <GefButton label="General" />
    <GefButton label="Appearance" />
    <GefButton label="Keyboard" />
    <GefButton label="About" />
  </Grid>
</Flex>

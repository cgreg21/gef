<Flex direction="column" gap="16" margin-top="20">
  <GefSectionHeader title="Preferences" description="Configure how the extension behaves on your desktop." />
  <Flex direction="row" gap="12">
    <Flex direction="column" gap="4">
      <GefLabel text="Automatic updates" />
      <GefLabel text="Install stable updates automatically" />
    </Flex>
    <GefSwitch [active]="true" />
  </Flex>
  <GtkSeparator orientation="horizontal" />
  <Flex direction="row" gap="12">
    <Flex direction="column" gap="4">
      <GefLabel text="Show notifications" />
      <GefLabel text="Notify when an update is available" />
    </Flex>
    <GefSwitch [active]="true" />
  </Flex>
  <Flex direction="row" gap="8">
    <GefCheckbox [checked]="true" />
    <GefLabel text="Start with the desktop" />
  </Flex>
  <Flex direction="row" gap="8">
    <GefCheckbox [checked]="false" />
    <GefLabel text="Include beta releases" />
  </Flex>
  <GtkSeparator orientation="horizontal" />
  <GefLabel text="Update frequency" />
  <GtkSpinButton value="6" />
</Flex>

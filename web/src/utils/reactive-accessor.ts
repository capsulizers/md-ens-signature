/**
 * Runs `sync` on the host after the decorated accessor is set, so a consumed
 * context can drive a controller from its setter rather than a lifecycle hook.
 */
export function syncAfterSet<Host, Value>(sync: (host: Host) => void): (
  target: ClassAccessorDecoratorTarget<Host, Value>,
  context: ClassAccessorDecoratorContext<Host, Value>,
) => ClassAccessorDecoratorResult<Host, Value> {
  return (
    target: ClassAccessorDecoratorTarget<Host, Value>,
    _context: ClassAccessorDecoratorContext<Host, Value>,
  ): ClassAccessorDecoratorResult<Host, Value> => ({
    set(this: Host, value: Value): void {
      target.set.call(this, value);
      sync(this);
    },
  });
}

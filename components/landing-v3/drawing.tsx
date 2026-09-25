/**
 * Bindet eine der generierten Linienzeichnungen (drawings.generated.ts) ein.
 * Der Wrapper hat display:contents, damit das SVG selbst Grid- oder Flex-Kind bleibt wie im Entwurf.
 */
export function Drawing({ svg }: { svg: string }) {
  return <div className="lf-svg" dangerouslySetInnerHTML={{ __html: svg }} />
}

import './BankadaLogo.css'

export type BankadaLogoSize = 'sm' | 'md' | 'lg' | 'xl'

type BankadaLogoProps = {
  size?: BankadaLogoSize
  className?: string
  showText?: boolean
  showLabel?: boolean
}

export function BankadaLogo({ size = 'md', className = '', showText = false, showLabel = false }: BankadaLogoProps) {
  return <span className={`bankada-logo bankada-logo-${size} ${className}`.trim()}>
    <span className="bankada-logo-image-wrap"><img src="/bankada-logo.png" alt="Bankada Logo" /></span>
    {(showText || showLabel) && <span className="bankada-logo-text">Bankada</span>}
  </span>
}

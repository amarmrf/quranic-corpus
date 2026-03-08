import { combineClassNames } from '../theme/class-names';
import './icon-button.scss';

type Props = {
    className?: string,
    icon: string,
    alt?: string,
    onClick: () => void
}

export const IconButton = ({ className, icon, alt = '', onClick }: Props) => (
    <img
        className={combineClassNames('icon-button', className)}
        src={icon}
        alt={alt}
        onClick={onClick} />
)

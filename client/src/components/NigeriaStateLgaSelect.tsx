import { NIGERIAN_STATES, getLgasForState } from '../data/nigeria-locations';

interface Props {
  stateValue: string;
  lgaValue: string;
  onStateChange: (state: string) => void;
  onLgaChange: (lga: string) => void;
  stateLabel?: string;
  lgaLabel?: string;
  required?: boolean;
  stateId?: string;
  lgaId?: string;
  className?: string;
}

export default function NigeriaStateLgaSelect({
  stateValue,
  lgaValue,
  onStateChange,
  onLgaChange,
  stateLabel = 'State of Origin',
  lgaLabel = 'Local Government Area (LGA)',
  required = false,
  stateId = 'state-of-origin',
  lgaId = 'lga',
  className = 'form-control form-select',
}: Props) {
  const lgaOptions = stateValue ? getLgasForState(stateValue) : [];

  return (
    <>
      <div className="form-group">
        <label className="form-label" htmlFor={stateId}>
          {stateLabel}{required ? ' *' : ''}
        </label>
        <select
          id={stateId}
          className={className}
          required={required}
          value={stateValue}
          onChange={(e) => {
            onStateChange(e.target.value);
            onLgaChange('');
          }}
        >
          <option value="">Select state…</option>
          {NIGERIAN_STATES.map((s) => (
            <option key={s} value={s}>{s}</option>
          ))}
        </select>
      </div>
      <div className="form-group">
        <label className="form-label" htmlFor={lgaId}>
          {lgaLabel}{required ? ' *' : ''}
        </label>
        <select
          id={lgaId}
          className={className}
          required={required}
          disabled={!stateValue}
          value={lgaValue}
          onChange={(e) => onLgaChange(e.target.value)}
        >
          <option value="">{stateValue ? 'Select LGA…' : 'Select state first'}</option>
          {lgaOptions.map((lga) => (
            <option key={lga} value={lga}>{lga}</option>
          ))}
        </select>
      </div>
    </>
  );
}

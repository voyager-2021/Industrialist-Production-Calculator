import React, { useState, useRef, useCallback, useMemo } from 'react';
import ReactDOM from 'react-dom';
import { getSettingsConfig } from './settingsConfig.jsx';
import { products } from '../data/dataLoader';

const UnifiedSettings = ({ recipeType, nodeId, currentSettings, recipe, globalPollution, onSettingsChange, onClose }) => {
  const config = getSettingsConfig(recipeType, recipe, globalPollution);
  const [settings, setSettings] = useState(currentSettings || config.defaultSettings);
  const bubbleRef = useRef(null);

  const handleWheel = (e) => {
    const element = bubbleRef.current;
    if (!element) return;

    const isScrollable = element.scrollHeight > element.clientHeight;
    const isAtTop = element.scrollTop === 0 && e.deltaY < 0;
    const isAtBottom = element.scrollTop + element.clientHeight >= element.scrollHeight && e.deltaY > 0;

    if (isScrollable && !isAtTop && !isAtBottom) {
      e.stopPropagation();
    } else if (isScrollable) {
      e.preventDefault();
      e.stopPropagation();
    } else {
      e.preventDefault();
      e.stopPropagation();
    }
  };

  const updateSetting = (key, value) => {
    // Handle dual-select special case
    if (typeof key === 'object') {
      setSettings(prev => ({ ...prev, ...key }));
    } else {
      setSettings(prev => ({ ...prev, [key]: value }));
    }
  };

  const handleApply = () => {
    const result = config.onApply(settings, recipe);
    
    // Different handlers have different signatures
    switch (recipeType) {
      case 'drill':
      case 'assembler':
      case 'treeFarm':
      case 'wasteFacility':
        // (nodeId, settings, inputs, outputs)
        onSettingsChange(nodeId, result.settings, result.inputs, result.outputs);
        break;
      
      case 'firebox':
        // (nodeId, settings, inputs, metrics)
        onSettingsChange(nodeId, result.settings, result.inputs, result.metrics);
        break;
      
      case 'temperature':
        // (nodeId, settings, outputs, powerConsumption)
        onSettingsChange(nodeId, result.settings, result.outputs, result.metrics);
        break;
      
      case 'boiler':
      case 'chemicalPlant':
        // (nodeId, settings)
        onSettingsChange(nodeId, result.settings);
        break;
      
      default:
        onSettingsChange(nodeId, result.settings, result.inputs, result.outputs, result.metrics);
    }
    
    onClose();
  };

  const handleReset = () => {
    setSettings(config.defaultSettings);
  };

  const metrics = config.calculateMetrics ? config.calculateMetrics(settings, recipe) : null;

  return ReactDOM.createPortal(
    <div className="drill-settings-overlay" onClick={onClose}>
      <div 
        ref={bubbleRef} 
        className="drill-settings-bubble" 
        onClick={(e) => e.stopPropagation()} 
        onDoubleClick={(e) => e.stopPropagation()} 
        onWheel={handleWheel}
      >
        <h3 className="drill-settings-title">{config.title}</h3>

        <div className="drill-settings-content">
          {config.fields.map((field, idx) => (
            <SettingsField
              key={idx}
              field={field}
              value={settings[field.key]}
              settings={settings}
              onChange={(key, value) => {
                // For dual-select, key and value are passed separately
                if (field.type === 'dual-select') {
                  updateSetting(key, value);
                } else {
                  updateSetting(field.key, key); // key is actually the value here for non-dual-select
                }
              }}
            />
          ))}

          {metrics && config.renderMetrics && (
            <div className="drill-setting-group" style={{ 
              marginTop: '20px', padding: '12px', background: 'rgba(212, 166, 55, 0.1)', 
              borderRadius: '8px', fontSize: '13px' 
            }}>
              {config.renderMetrics(metrics, settings)}
            </div>
          )}
        </div>

        <div className="drill-settings-buttons">
          <button onClick={handleReset} className="btn btn-secondary">Reset</button>
          <button onClick={handleApply} className="btn btn-primary" disabled={config.hasErrors?.(settings)}>
            Apply
          </button>
        </div>
      </div>
    </div>,
    document.body
  );
};

const SettingsField = ({ field, value, settings, onChange }) => {
  switch (field.type) {
    case 'select':
      return (
        <div className="drill-setting-group">
          <label className="drill-setting-label">{field.label}</label>
          <select 
            value={value} 
            onChange={(e) => onChange(field.parse ? field.parse(e.target.value) : e.target.value)} 
            className="select"
            disabled={field.disabled?.(settings)}
          >
            {field.options.map(opt => (
              <option key={opt.value} value={opt.value}>
                {opt.label}
              </option>
            ))}
          </select>
          {field.hint && (
            <p style={{ fontSize: '11px', color: 'var(--text-secondary)', marginTop: '4px' }}>
              {typeof field.hint === 'function' ? field.hint(value, settings) : field.hint}
            </p>
          )}
        </div>
      );

    case 'checkbox':
      return (
        <div className="drill-setting-group drill-setting-checkbox">
          <label className="drill-setting-label">
            <input 
              type="checkbox" 
              checked={value} 
              onChange={(e) => onChange(e.target.checked)} 
              className="drill-checkbox" 
            />
            <span>{field.label}</span>
          </label>
        </div>
      );

    case 'number':
      return (
        <div className="drill-setting-group">
          <label className="drill-setting-label">{field.label}</label>
          <input
            type="number"
            min={field.min}
            max={field.max}
            step={field.step}
            value={value}
            onChange={(e) => onChange(field.parse ? field.parse(e.target.value) : parseFloat(e.target.value))}
            className="input"
            placeholder={field.placeholder}
            style={field.hasError?.(value) ? { borderColor: '#ef4444' } : {}}
          />
          {field.hint && (
            <p style={{ fontSize: '11px', color: 'var(--text-secondary)', marginTop: '4px' }}>
              {typeof field.hint === 'function' ? field.hint(value, settings) : field.hint}
            </p>
          )}
        </div>
      );

    case 'number-buttons':
      return (
        <div className="drill-setting-group">
          <label className="drill-setting-label">{field.label}</label>
          <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
            <button 
              onClick={() => onChange(Math.max(field.min, value - field.step))} 
              disabled={value <= field.min}
              className="btn btn-secondary"
              style={{ 
                padding: '8px 16px', 
                minWidth: 'auto',
                fontSize: '18px',
                opacity: value <= field.min ? 0.5 : 1,
                cursor: value <= field.min ? 'not-allowed' : 'pointer'
              }}
            >
              ▼
            </button>
            <div style={{
              flex: 1,
              textAlign: 'center',
              padding: '12px',
              background: 'var(--bg-main)',
              border: '2px solid var(--border-primary)',
              borderRadius: 'var(--radius-sm)',
              color: 'var(--text-primary)',
              fontSize: '20px',
              fontWeight: 700
            }}>
              {value}
            </div>
            <button 
              onClick={() => onChange(Math.min(field.max, value + field.step))} 
              disabled={value >= field.max}
              className="btn btn-secondary"
              style={{ 
                padding: '8px 16px', 
                minWidth: 'auto',
                fontSize: '18px',
                opacity: value >= field.max ? 0.5 : 1,
                cursor: value >= field.max ? 'not-allowed' : 'pointer'
              }}
            >
              ▲
            </button>
          </div>
          <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: '12px', color: 'var(--text-secondary)', marginTop: '8px' }}>
            <span>Min: {field.min}</span>
            <span>Default: {field.defaultValue}</span>
            <span>Max: {field.max}</span>
          </div>
        </div>
      );

    case 'text-input':
      return (
        <div className="drill-setting-group">
          <label className="drill-setting-label">{field.label}</label>
          <input
            type="text"
            value={value}
            onChange={(e) => onChange(e.target.value)}
            placeholder={field.placeholder}
            className="input"
            style={{ marginBottom: field.noMargin ? 0 : '15px' }}
          />
        </div>
      );

    case 'dual-select':
      return (
        <div className="drill-setting-group">
          <label className="drill-setting-label">{field.label}</label>
          <div style={{ display: 'flex', gap: '10px', alignItems: 'center' }}>
            <select 
              value={settings[field.outerKey] || ''} 
              onChange={(e) => {
                const newOuter = e.target.value;
                onChange(field.outerKey, newOuter);
                if (newOuter && parseInt(newOuter) > 1) {
                  onChange(field.innerKey, '64');
                }
              }}
              className="select" 
              style={{ flex: 1 }}
            >
              <option value="">Outer</option>
              {field.outerOptions.map(opt => (
                <option key={opt} value={opt}>{opt}x</option>
              ))}
            </select>
            <select 
              value={settings[field.innerKey] || ''} 
              onChange={(e) => onChange(field.innerKey, e.target.value)}
              className="select" 
              style={{ flex: 1 }}
              disabled={settings[field.outerKey] && parseInt(settings[field.outerKey]) > 1}
            >
              <option value="">Inner</option>
              {(settings[field.outerKey] && parseInt(settings[field.outerKey]) > 1) ? (
                <option value="64">64x</option>
              ) : (
                field.innerOptions.map(opt => (
                  <option key={opt} value={opt}>{opt}x</option>
                ))
              )}
            </select>
            <span style={{ color: '#f5d56a', fontWeight: 600, whiteSpace: 'nowrap' }}>{field.suffix}</span>
          </div>
          {field.renderPreview && field.renderPreview(settings)}
        </div>
      );

    case 'info-box':
      return (
        <div className="drill-setting-group" style={{ 
          marginTop: field.marginTop || '20px', 
          padding: '12px', 
          background: field.background || 'rgba(212, 166, 55, 0.1)', 
          borderRadius: '8px', 
          fontSize: '13px' 
        }}>
          <div style={{ color: field.titleColor || '#f5d56a', fontWeight: 600, marginBottom: '8px' }}>
            {field.title}
          </div>
          <div style={{ color: '#999', lineHeight: '1.6' }}>
            {field.render(value, settings)}
          </div>
        </div>
      );

    case 'product-input':
      return <ProductInputField field={field} value={value} onChange={onChange} />;

    case 'dynamic-list':
      return (
        <div className="drill-setting-group">
          <label className="drill-setting-label" style={{ marginBottom: '8px', display: 'block' }}>{field.label}</label>
          <div style={{ display: 'flex', flexDirection: 'column', gap: '6px' }}>
            {value.map((item, idx) => (
              <div key={idx} style={{
                display: 'flex', gap: '6px', alignItems: 'flex-start',
                padding: '8px', background: 'var(--bg-main)',
                borderRadius: 'var(--radius-sm)', border: '1px solid var(--border-light)'
              }}>
                <span style={{ fontSize: '11px', color: 'var(--text-muted)', marginTop: '8px', minWidth: '16px' }}>{idx + 1}.</span>
                {field.subFields.map((subField, sfIdx) => (
                  <div key={sfIdx} style={{ flex: subField.type === 'product-input' ? 3 : 1, minWidth: 0 }}>
                    <SettingsField
                      field={{
                        ...subField,
                        noMargin: true,
                        label: ''
                      }}
                      value={item[subField.key]}
                      settings={settings}
                      onChange={(newVal) => {
                        const newItems = [...value];
                        newItems[idx] = { ...newItems[idx], [subField.key]: newVal };
                        onChange(newItems);
                      }}
                    />
                  </div>
                ))}
                <button
                  onClick={() => {
                    const newItems = value.filter((_, i) => i !== idx);
                    onChange(newItems);
                  }}
                  style={{
                    background: 'none', border: 'none', cursor: 'pointer',
                    color: '#ef4444', fontSize: '16px', padding: '6px 4px',
                    lineHeight: 1, flexShrink: 0, marginTop: '2px'
                  }}
                  title="Remove"
                >
                  ✕
                </button>
              </div>
            ))}
          </div>
          <button
            onClick={() => {
              onChange([...value, { ...field.defaultItem }]);
            }}
            className="btn btn-secondary"
            style={{ marginTop: '8px', padding: '6px 12px', fontSize: '12px', minWidth: 'auto' }}
          >
            + Add {field.label === 'Inputs' ? 'Input' : field.label === 'Outputs' ? 'Output' : 'Item'}
          </button>
        </div>
      );

    default:
      return null;
  }
};

const ProductInputField = ({ field, value, onChange }) => {
  const [focused, setFocused] = useState(false);
  const [search, setSearch] = useState(() => {
    if (!value) return '';
    const product = products.find(p => p.id === value);
    return product ? product.name : value;
  });
  const inputRef = useRef(null);
  const dropdownRef = useRef(null);

  const filtered = useMemo(() => {
    if (!search) return products.slice(0, 50);
    const lower = search.toLowerCase();
    return products.filter(p =>
      p.name.toLowerCase().includes(lower) ||
      p.id.toLowerCase().includes(lower)
    ).slice(0, 100);
  }, [search]);

  const handleSelect = (product) => {
    setSearch(product.name);
    onChange(product.id);
    setFocused(false);
  };

  const handleInputChange = (text) => {
    setSearch(text);
    onChange(text);
  };

  const handleBlur = (e) => {
    if (dropdownRef.current && dropdownRef.current.contains(e.relatedTarget)) return;
    setTimeout(() => setFocused(false), 200);
  };

  return (
    <div style={{ position: 'relative', marginBottom: field.noMargin ? 0 : '15px' }}>
      {field.label && <label className="drill-setting-label">{field.label}</label>}
      <input
        ref={inputRef}
        type="text"
        value={search}
        onChange={(e) => handleInputChange(e.target.value)}
        onFocus={() => setFocused(true)}
        onBlur={handleBlur}
        placeholder={field.placeholder || 'Search product...'}
        className="input"
        style={{ width: '100%' }}
      />
      {focused && search && filtered.length > 0 && (
        <div ref={dropdownRef}
          style={{
            position: 'absolute', top: '100%', left: 0, right: 0, zIndex: 100,
            background: 'var(--bg-secondary)', border: '1px solid var(--border-primary)',
            borderRadius: 'var(--radius-sm)', maxHeight: '200px', overflowY: 'auto',
            boxShadow: '0 4px 12px rgba(0,0,0,0.3)'
          }}
        >
          {filtered.map(p => (
            <div key={p.id}
              onClick={() => handleSelect(p)}
              style={{
                padding: '6px 10px', cursor: 'pointer', fontSize: '12px',
                color: 'var(--text-primary)', borderBottom: '1px solid var(--border-light)',
                display: 'flex', justifyContent: 'space-between', gap: '8px'
              }}
              onMouseEnter={(e) => e.currentTarget.style.background = 'var(--bg-main)'}
              onMouseLeave={(e) => e.currentTarget.style.background = 'transparent'}
            >
              <span>{p.name}</span>
              <span style={{ color: 'var(--text-muted)', fontSize: '10px', flexShrink: 0 }}>
                {p.type === 'fluid' ? '💧' : '📦'} {p.price === 'Variable' ? '' : `$${p.price}`}
              </span>
            </div>
          ))}
        </div>
      )}
    </div>
  );
};

export default UnifiedSettings;
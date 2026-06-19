import { 
  DRILL_HEADS, CONSUMABLES, getAvailableDepths, calculateDrillMetrics, 
  buildDrillInputs, buildDrillOutputs 
} from '../data/mineshaftDrill';
import { 
  calculateLogicAssemblerMetrics, buildLogicAssemblerInputs, buildLogicAssemblerOutputs 
} from '../data/logicAssembler';
import { 
  calculateTreeFarmMetrics, buildTreeFarmInputs, buildTreeFarmOutputs, 
  calculateRequiredWaterTanks 
} from '../data/treeFarm';
import { 
  FUEL_PRODUCTS, calculateFireboxMetrics, buildFireboxInputs 
} from '../data/industrialFirebox';
import { 
  calculateChemicalPlantMetrics 
} from '../data/chemicalPlant';

import { 
  HEAT_SOURCES, calculateOutputTemperature, getPowerConsumptionForTemperature, 
  formatTemperature 
} from '../utils/temperatureUtils';
import { getProductName } from '../utils/variableHandler';
import { getProduct, products } from '../data/dataLoader';

// Helper to match a product by name or ID
const findProduct = (searchText) => {
  if (!searchText) return null;
  const lower = searchText.toLowerCase();
  return products.find(p =>
    p.id.toLowerCase() === lower ||
    p.name.toLowerCase() === lower ||
    p.name.toLowerCase().includes(lower)
  );
};

// Helper to format power
const formatPower = (power) => {
  if (!power) return 'N/A';
  if (power >= 1000000) return `${(power / 1000000).toFixed(1)} MMF/s`;
  if (power >= 1000) return `${(power / 1000).toFixed(1)} kMF/s`;
  return `${power.toFixed(0)} MF/s`;
};

// Configuration for each recipe type
export const getSettingsConfig = (recipeType, recipe, globalPollution) => {
  switch (recipeType) {
    case 'drill':
      return getDrillConfig();
    case 'assembler':
      return getAssemblerConfig();
    case 'treeFarm':
      return getTreeFarmConfig(globalPollution);
    case 'firebox':
      return getFireboxConfig(recipe);
    case 'temperature':
      return getTemperatureConfig(recipe);
    case 'boiler':
      return getBoilerConfig();
    case 'chemicalPlant':
      return getChemicalPlantConfig();
    case 'custom':
      return getCustomConfig();
    default:
      return null;
  }
};

// Drill configuration
const getDrillConfig = () => ({
  title: 'Mineshaft Drill Settings',
  defaultSettings: { drillHead: '', consumable: 'none', machineOil: false, depth: '' },
  fields: [
    {
      type: 'select',
      key: 'drillHead',
      label: 'Drill Head:',
      options: [
        { value: '', label: 'None (Variable)' },
        ...DRILL_HEADS.map(h => ({ value: h.id, label: h.name }))
      ]
    },
    {
      type: 'select',
      key: 'consumable',
      label: 'Consumable:',
      options: CONSUMABLES.map(c => ({ value: c.id, label: c.name }))
    },
    {
      type: 'checkbox',
      key: 'machineOil',
      label: 'Machine Oil (2/s)'
    },
    {
      type: 'select',
      key: 'depth',
      label: 'Target Depth:',
      options: [
        { value: '', label: 'None (Variable)' },
        ...getAvailableDepths().map(d => ({ value: d.toString(), label: `${d} m` }))
      ]
    }
  ],
  calculateMetrics: (settings) => {
    return settings.drillHead && settings.depth 
      ? calculateDrillMetrics(settings.drillHead, settings.consumable, settings.machineOil, parseInt(settings.depth))
      : null;
  },
  renderMetrics: (metrics) => (
    <>
      <div style={{ color: '#f5d56a', fontWeight: 600, marginBottom: '12px' }}>Calculated Metrics:</div>
      <div style={{ color: '#999', lineHeight: '1.6', marginBottom: '12px' }}>
        <div>Deterioration: {metrics.deteriorationRate.toFixed(4)}%/s</div>
        <div>Life Time: {metrics.lifeTime.toFixed(2)}s</div>
        <div>Replacement: {metrics.replacementTime.toFixed(2)}s</div>
        <div>Travel Time: {metrics.travelTime.toFixed(2)}s</div>
        <div>Total Cycle: {metrics.totalCycleTime.toFixed(2)}s</div>
        <div>Efficiency: {(metrics.dutyCycle * 100).toFixed(1)}%</div>
      </div>
    </>
  ),
  onApply: (settings) => {
    const inputs = buildDrillInputs(settings.drillHead, settings.consumable, settings.machineOil, settings.depth ? parseInt(settings.depth) : null);
    const outputs = buildDrillOutputs(settings.drillHead, settings.consumable, settings.machineOil, settings.depth ? parseInt(settings.depth) : null);
    const metrics = settings.drillHead && settings.depth 
      ? calculateDrillMetrics(settings.drillHead, settings.consumable, settings.machineOil, parseInt(settings.depth))
      : null;
    
    return { settings, inputs, outputs, metrics };
  }
});

// Assembler configuration
const getAssemblerConfig = () => ({
  title: 'Logic Assembler Settings',
  defaultSettings: { outerStage: '', innerStage: '', machineOil: false, tickCircuitDelay: 0 },
  fields: [
    {
      type: 'dual-select',
      key: 'microchip',
      outerKey: 'outerStage',
      innerKey: 'innerStage',
      label: 'Target Microchip:',
      outerOptions: [1, 2, 3, 4, 5, 6, 7, 8],
      innerOptions: [2, 4, 8, 16, 32, 64],
      suffix: 'Microchip',
      renderPreview: (settings) => {
        const outer = settings.outerStage;
        const inner = settings.innerStage;
        const targetMicrochip = outer && inner
          ? (parseInt(outer) === 1 ? `${inner}x Microchip` : `${outer}x${inner}x Microchip`)
          : '';
        return targetMicrochip ? (
          <div style={{ fontSize: '12px', color: '#999', marginTop: '4px' }}>{targetMicrochip}</div>
        ) : null;
      }
    },
    {
      type: 'checkbox',
      key: 'machineOil',
      label: 'Machine Oil (0.3/s, 5x speed)'
    },
    {
      type: 'number',
      key: 'tickCircuitDelay',
      label: 'Tick Circuit Delay (ticks):',
      min: 0,
      step: 0.1,
      placeholder: '0',
      parse: (val) => val === '' ? 0 : parseFloat(val)
    }
  ],
  calculateMetrics: (settings) => {
    const getTargetMicrochip = () => {
      if (!settings.outerStage || !settings.innerStage) return '';
      return settings.outerStage === '1' || parseInt(settings.outerStage) === 1
        ? `p_${settings.innerStage}x_microchip`
        : `p_${settings.outerStage}x${settings.innerStage}x_microchip`;
    };
    const targetMicrochip = getTargetMicrochip();
    return targetMicrochip ? calculateLogicAssemblerMetrics(targetMicrochip, settings.machineOil, settings.tickCircuitDelay) : null;
  },
  renderMetrics: (metrics) => (
    <>
      <div style={{ color: '#f5d56a', fontWeight: 600, marginBottom: '12px' }}>Calculated Metrics:</div>
      <div style={{ color: '#999', lineHeight: '1.6', marginBottom: '12px' }}>
        <div>Total Stages: {metrics.totalStages}</div>
        <div>Total Steps: {metrics.totalSteps}</div>
        <div>Avg Step Time: {metrics.avgStepTime}s</div>
        <div>Cycle Time: {metrics.cycleTime.toFixed(2)}s</div>
      </div>
      <div style={{ borderTop: '1px solid rgba(212, 166, 55, 0.3)', paddingTop: '10px', marginBottom: '10px' }}>
        <div style={{ color: '#f5d56a', fontWeight: 600, marginBottom: '6px' }}>Power Consumption:</div>
        <div style={{ color: '#999', lineHeight: '1.6', paddingLeft: '10px' }}>
          <div>{(metrics.avgPowerConsumption / 1000).toFixed(2)} kMF/s</div>
        </div>
      </div>
      <div style={{ borderTop: '1px solid rgba(212, 166, 55, 0.3)', paddingTop: '10px' }}>
        <div style={{ color: 'var(--settings-input-label)', fontWeight: 600, marginBottom: '6px' }}>Materials per Cycle:</div>
        <div style={{ color: '#999', lineHeight: '1.5', fontSize: '12px', paddingLeft: '10px' }}>
          <div>Logic Plates: {metrics.logicPlates}</div>
          <div>Copper Wires: {metrics.copperWires}</div>
          <div>Semiconductors: {metrics.semiconductors}</div>
          <div>Gold Wires: {metrics.goldWires}</div>
        </div>
      </div>
    </>
  ),
  onApply: (settings) => {
    // Convert dual-select format back to individual settings
    const actualSettings = {
      outerStage: settings.outerStage || (settings.microchip?.outer || ''),
      innerStage: settings.innerStage || (settings.microchip?.inner || ''),
      machineOil: settings.machineOil,
      tickCircuitDelay: settings.tickCircuitDelay
    };
    
    const getTargetMicrochip = () => {
      if (!actualSettings.outerStage || !actualSettings.innerStage) return '';
      return parseInt(actualSettings.outerStage) === 1
        ? `p_${actualSettings.innerStage}x_microchip`
        : `p_${actualSettings.outerStage}x${actualSettings.innerStage}x_microchip`;
    };
    
    const targetMicrochip = getTargetMicrochip();
    const inputs = buildLogicAssemblerInputs(targetMicrochip, actualSettings.machineOil);
    const outputs = buildLogicAssemblerOutputs(targetMicrochip, actualSettings.machineOil);
    
    return { settings: actualSettings, inputs, outputs, metrics: null };
  }
});

// Tree Farm configuration
const getTreeFarmConfig = (globalPollution) => ({
  title: 'Tree Farm Settings',
  defaultSettings: { trees: 450, harvesters: 20, sprinklers: 24, outputs: 8, controller: 1 },
  fields: [
    {
      type: 'number',
      key: 'trees',
      label: 'Trees (max 500):',
      min: 1,
      max: 500,
      step: 1,
      hasError: (val) => val > 500 || val < 1
    },
    {
      type: 'number',
      key: 'harvesters',
      label: 'Harvesters:',
      min: 1,
      step: 1,
      hasError: (val) => val < 1
    },
    {
      type: 'number',
      key: 'sprinklers',
      label: 'Sprinklers:',
      min: 1,
      step: 1,
      hasError: (val) => val < 1,
      hint: function(val) {
        const waterTanks = calculateRequiredWaterTanks(val);
        return `Requires ${waterTanks} water tank${waterTanks !== 1 ? 's' : ''} (3 sprinklers per tank)`;
      }
    },
    {
      type: 'number',
      key: 'outputs',
      label: 'Outputs:',
      min: 1,
      step: 1,
      hasError: (val) => val < 1
    },
    {
      type: 'number',
      key: 'controller',
      label: 'Controller:',
      min: 1,
      max: 1,
      step: 1,
      disabled: () => true
    }
  ],
  calculateMetrics: (settings) => {
    return calculateTreeFarmMetrics(
      settings.trees, 
      settings.harvesters, 
      settings.sprinklers, 
      settings.outputs, 
      settings.controller, 
      globalPollution
    );
  },
  renderMetrics: (metrics, settings) => (
    <>
      <div style={{ color: '#f5d56a', fontWeight: 600, marginBottom: '12px' }}>Calculated Metrics:</div>
      <div style={{ color: '#999', lineHeight: '1.6', marginBottom: '12px' }}>
        <div>Growth Time: {metrics.growthTime}s (at {typeof globalPollution === 'number' ? globalPollution.toFixed(1) : globalPollution}% pollution)</div>
        <div>Water Tanks: {metrics.waterTanks}</div>
        <div>Sustainable Rate: {metrics.sustainableHarvestRate.toFixed(4)} trees/s</div>
        <div>Max Harvest Rate: {metrics.maxHarvestRate.toFixed(4)} trees/s</div>
        <div>Actual Rate: {metrics.actualHarvestRate.toFixed(4)} trees/s</div>
        <div>Power: {(metrics.avgPowerConsumption / 1000).toFixed(2)} kMF/s</div>
        {metrics.isTreeLimited && (
          <div style={{ color: 'var(--settings-output-label)', marginTop: '8px', fontStyle: 'italic' }}>
            ⚠️ Limited by tree regrowth rate
          </div>
        )}
      </div>
    </>
  ),
  hasErrors: (settings) => {
    return settings.trees > 500 || settings.trees < 1 || 
           settings.harvesters < 1 || settings.sprinklers < 1 || settings.outputs < 1;
  },
  onApply: (settings, recipe) => {
    const inputs = buildTreeFarmInputs(settings.sprinklers);
    const outputs = buildTreeFarmOutputs(settings.trees, settings.harvesters, globalPollution);
    return { settings, inputs, outputs, metrics: null };
  }
});

// Firebox configuration
const getFireboxConfig = (recipe) => ({
  title: 'Industrial Firebox Settings',
  defaultSettings: { fuel: 'p_coal' },
  fields: [
    {
      type: 'select',
      key: 'fuel',
      label: 'Fuel Type:',
      options: FUEL_PRODUCTS.map(f => ({
        value: f.id,
        label: `${f.name} (${(f.energy / 1000).toFixed(0)}k energy)`
      }))
    }
  ],
  calculateMetrics: (settings) => calculateFireboxMetrics(recipe.id, settings.fuel),
  renderMetrics: (metrics, settings) => (
    <>
      <div style={{ color: '#f5d56a', fontWeight: 600, marginBottom: '12px' }}>Calculated Metrics:</div>
      <div style={{ color: '#999', lineHeight: '1.6', marginBottom: '12px' }}>
        <div>Energy Needed: {(metrics.energyNeeded / 1000).toFixed(0)}k</div>
        <div>Fuel Energy: {(metrics.fuelEnergy / 1000).toFixed(0)}k per unit</div>
        <div>Wait Time: {metrics.waitTime.toFixed(2)}s</div>
        {metrics.additionalWait > 0 && (
          <div>Additional Wait: +{metrics.additionalWait}s</div>
        )}
        <div style={{ fontWeight: 600, marginTop: '8px', color: '#f5d56a' }}>
          Total Cycle: {metrics.cycleTime.toFixed(2)}s
        </div>
        <div>Fuel Per Cycle: {metrics.fuelPerCycle.toFixed(2)} units</div>
        <div style={{ fontSize: '11px', fontStyle: 'italic', marginTop: '8px', color: 'var(--text-muted)' }}>
          Rate: {(1 / metrics.cycleTime).toFixed(4)} cycles/s
        </div>
      </div>
      <div style={{ borderTop: '1px solid rgba(212, 166, 55, 0.3)', paddingTop: '12px' }}>
        <div style={{ color: 'var(--settings-input-label)', fontWeight: 600, marginBottom: '8px', fontSize: '12px' }}>
          Inputs (per cycle):
        </div>
        <div style={{ color: '#999', lineHeight: '1.5', fontSize: '12px' }}>
          {buildFireboxInputs(recipe.inputs, settings.fuel, recipe.id).map((input, idx) => {
            const quantityStr = typeof input.quantity === 'number' ? input.quantity.toFixed(4) : input.quantity;
            const productName = getProductName(input.product_id, getProduct);
            return (
              <div key={idx}>
                {quantityStr}x {productName}
              </div>
            );
          })}
        </div>
      </div>
    </>
  ),
  onApply: (settings, recipe) => {
    const metrics = calculateFireboxMetrics(recipe.id, settings.fuel);
    const inputs = buildFireboxInputs(recipe.inputs, settings.fuel, recipe.id);
    return { settings, inputs, outputs: [], metrics };
  }
});

// Temperature configuration
const getTemperatureConfig = (recipe) => {
  const machineId = recipe.machine_id;
  const heatSource = HEAT_SOURCES[machineId];
  
  return {
    title: `${heatSource.name} Settings`,
    defaultSettings: { temperature: heatSource.tempOptions?.[0]?.temp || 120 },
    fields: [
      {
        type: 'select',
        key: 'temperature',
        label: 'Output Temperature:',
        parse: (val) => parseInt(val),
        options: heatSource.tempOptions.map(opt => ({
          value: opt.temp,
          label: `${formatTemperature(opt.temp)} - ${formatPower(opt.power)}`
        }))
      },
      {
        type: 'info-box',
        key: 'temperature',
        title: 'Preview:',
        render: (value, settings) => {
          const temp = settings.temperature;
          const power = getPowerConsumptionForTemperature(machineId, temp);
          return (
            <>
              <div>Output Temperature: {formatTemperature(temp)}</div>
              <div>Power Consumption: {formatPower(power)}</div>
            </>
          );
        }
      }
    ],
    onApply: (settings, recipe) => {
      const powerConsumption = getPowerConsumptionForTemperature(machineId, settings.temperature);
      const updatedOutputs = recipe.outputs.map(output => ({
        ...output,
        temperature: calculateOutputTemperature(machineId, settings)
      }));
      return { settings, inputs: [], outputs: updatedOutputs, metrics: powerConsumption };
    }
  };
};

// Boiler configuration
const getBoilerConfig = () => ({
  title: 'Boiler Settings',
  defaultSettings: { heatLoss: 0 },
  fields: [
    {
      type: 'number',
      key: 'heatLoss',
      label: 'Heat Loss (°C):',
      min: 0,
      max: 50,
      step: 0.1,
      placeholder: '8',
      hint: 'Temperature loss when converting hot water to steam. Default is 0°C.'
    },
    {
      type: 'info-box',
      title: 'How it works:',
      render: (heatLoss) => (
        <>
          <div>• Boiler uses the <strong>second input</strong> (hot water coolant) temperature</div>
          <div>• Steam output temp = Coolant temp - {heatLoss}°C</div>
          <div>• If output temp &lt; 100°C, no steam is produced</div>
          <div>• Water output is cooled (no temperature)</div>
          <div style={{ marginTop: '8px', fontStyle: 'italic', fontSize: '12px' }}>
            Tip: For 100°C steam with {heatLoss}°C loss, use {100 + heatLoss}°C coolant
          </div>
        </>
      )
    }
  ],
  onApply: (settings) => {
    return { settings, inputs: [], outputs: [], metrics: null };
  }
});

// Chemical Plant configuration
const getChemicalPlantConfig = () => ({
  title: 'Chemical Plant Settings',
  defaultSettings: { speedFactor: 100, efficiencyFactor: 100 },
  fields: [
    {
      type: 'number-buttons',
      key: 'speedFactor',
      label: 'Speed Factor',
      min: 50,
      max: 200,
      step: 5,
      defaultValue: 100
    },
    {
      type: 'number-buttons',
      key: 'efficiencyFactor',
      label: 'Efficiency Factor',
      min: 80,
      max: 120,
      step: 5,
      defaultValue: 100
    }
  ],
  calculateMetrics: (settings) => calculateChemicalPlantMetrics(settings.speedFactor, settings.efficiencyFactor),
  renderMetrics: (metrics) => (
    <>
      <div style={{ color: '#f5d56a', fontWeight: 600, marginBottom: '12px' }}>Applied Multipliers:</div>
      <div style={{ color: '#999', lineHeight: '1.6' }}>
        <div>Input Multiplier: {metrics.inputMultiplier.toFixed(4)}x</div>
        <div>Output Multiplier: {metrics.outputMultiplier.toFixed(4)}x</div>
        <div>Power Multiplier: {metrics.powerMultiplier.toFixed(4)}x</div>
      </div>
      <div style={{ marginTop: '12px', fontSize: '11px', color: 'var(--text-muted)', fontStyle: 'italic' }}>
        <div>• Speed affects input/output quantities and power</div>
        <div>• Efficiency affects input quantities and power</div>
        <div>• Effects combine additively</div>
      </div>
    </>
  ),
  onApply: (settings) => {
    return { settings, inputs: [], outputs: [], metrics: null };
  }
});

// Custom Recipe configuration
const getCustomConfig = () => ({
  title: 'Custom Recipe Settings',
  defaultSettings: {
    recipeName: 'Custom Recipe',
    machineName: 'Custom Machine',
    cycleTime: 5,
    powerConsumption: 0,
    powerType: 'MV',
    pollution: 0,
    cost: 0,
    inputs: [{ product: '', quantity: 1 }],
    outputs: [{ product: '', quantity: 1 }]
  },
  fields: [
    {
      type: 'text-input',
      key: 'recipeName',
      label: 'Recipe Name:',
      placeholder: 'e.g. Makes Widget'
    },
    {
      type: 'text-input',
      key: 'machineName',
      label: 'Machine Name:',
      placeholder: 'e.g. Widget Assembler'
    },
    {
      type: 'number',
      key: 'cycleTime',
      label: 'Cycle Time (s):',
      min: 0.01,
      step: 0.1,
      placeholder: '5',
      hasError: (val) => val <= 0
    },
    {
      type: 'number',
      key: 'powerConsumption',
      label: 'Power (MF/s, negative = generation):',
      step: 1,
      placeholder: '0'
    },
    {
      type: 'select',
      key: 'powerType',
      label: 'Power Type:',
      options: [
        { value: 'MV', label: 'MV' },
        { value: 'HV', label: 'HV' }
      ]
    },
    {
      type: 'number',
      key: 'pollution',
      label: 'Pollution (%/hr, negative = absorption):',
      step: 0.1,
      placeholder: '0'
    },
    {
      type: 'number',
      key: 'cost',
      label: 'Machine Cost ($):',
      min: 0,
      step: 1,
      placeholder: '0'
    },
    {
      type: 'dynamic-list',
      key: 'inputs',
      label: 'Inputs',
      subFields: [
        {
          type: 'product-input',
          key: 'product',
          label: 'Product',
          placeholder: 'Search product name...'
        },
        {
          type: 'number',
          key: 'quantity',
          label: 'Qty',
          min: 0.01,
          step: 1,
          placeholder: '1',
          hasError: (val) => val <= 0
        }
      ],
      defaultItem: { product: '', quantity: 1 }
    },
    {
      type: 'dynamic-list',
      key: 'outputs',
      label: 'Outputs',
      subFields: [
        {
          type: 'product-input',
          key: 'product',
          label: 'Product',
          placeholder: 'Search product name...'
        },
        {
          type: 'number',
          key: 'quantity',
          label: 'Qty',
          min: 0.01,
          step: 1,
          placeholder: '1',
          hasError: (val) => val <= 0
        }
      ],
      defaultItem: { product: '', quantity: 1 }
    }
  ],
  hasErrors: (settings) => {
    if (settings.cycleTime <= 0) return true;
    for (const item of settings.inputs) {
      if (item.quantity <= 0) return true;
    }
    for (const item of settings.outputs) {
      if (item.quantity <= 0) return true;
    }
    return false;
  },
  onApply: (settings) => {
    const resolveProductId = (productText) => {
      if (!productText) return 'p_any_item';
      const product = findProduct(productText);
      return product ? product.id : productText;
    };
    const resolveProductName = (productText) => {
      if (!productText) return 'Variable Item';
      const product = findProduct(productText);
      return product ? product.name : productText;
    };

    const inputs = settings.inputs
      .filter(item => item.product && item.quantity > 0)
      .map(item => ({
        product_id: resolveProductId(item.product),
        quantity: item.quantity,
        q_mode: 'none'
      }));

    const outputs = settings.outputs
      .filter(item => item.product && item.quantity > 0)
      .map(item => ({
        product_id: resolveProductId(item.product),
        quantity: item.quantity,
        q_mode: 'none'
      }));

    return {
      settings,
      inputs,
      outputs,
      metrics: {
        recipeName: settings.recipeName || 'Custom Recipe',
        machineName: settings.machineName || 'Custom Machine',
        cycleTime: settings.cycleTime || 5,
        powerConsumption: settings.powerConsumption || 0,
        powerType: settings.powerType || 'MV',
        pollution: settings.pollution || 0,
        cost: settings.cost || 0
      }
    };
  }
});

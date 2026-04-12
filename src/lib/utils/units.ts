export const KG_TO_LBS = 2.20462;
export const LBS_TO_KG = 1 / 2.20462;
export const CM_TO_IN = 0.393701;
export const IN_TO_CM = 2.54;

export function kgToLbs(kg: number): number {
	return kg * KG_TO_LBS;
}

export function lbsToKg(lbs: number): number {
	return lbs * LBS_TO_KG;
}

export function cmToIn(cm: number): number {
	return cm * CM_TO_IN;
}

export function inToCm(inches: number): number {
	return inches * IN_TO_CM;
}

export function formatWeight(kg: number, system: 'metric' | 'imperial'): string {
	if (system === 'imperial') {
		return `${kgToLbs(kg).toFixed(1)} lbs`;
	}
	return `${kg.toFixed(1)} kg`;
}

export function formatHeight(cm: number, system: 'metric' | 'imperial'): string {
	if (system === 'imperial') {
		const totalInches = cmToIn(cm);
		const feet = Math.floor(totalInches / 12);
		const inches = Math.round(totalInches % 12);
		return `${feet}'${inches}"`;
	}
	return `${Math.round(cm)} cm`;
}

import { GlobalRates } from '@/entities/GlobalRates';
import { Worker } from '@/entities/Worker';

/**
 * Propisuje výchozí hodinové sazby (dle seniority z GlobalRates) montážníkům.
 * @param {boolean} overwriteExisting - true = přepíše i stávající sazby, false = pouze prázdné
 */
export async function migrateWorkerRates({ overwriteExisting = false } = {}) {
  const allRates = await GlobalRates.list();
  let defaultRates = allRates.find(r => r.is_default);
  if (!defaultRates && allRates.length > 0) defaultRates = allRates[0];

  if (!defaultRates) {
    return { success: false, error: 'Výchozí sazby nejsou nastaveny.' };
  }

  const domestic = defaultRates.hourly_rates_domestic || {};
  const international = defaultRates.hourly_rates_international || {};

  const workers = await Worker.list();

  let updatedCount = 0;

  for (const worker of workers) {
    if (!worker.seniority) continue;

    const updateData = {};

    if (domestic[worker.seniority] && (overwriteExisting || !worker.hourly_rate_domestic)) {
      updateData.hourly_rate_domestic = domestic[worker.seniority];
    }
    if (international[worker.seniority] && (overwriteExisting || !worker.hourly_rate_international)) {
      updateData.hourly_rate_international = international[worker.seniority];
    }

    if (Object.keys(updateData).length > 0) {
      await Worker.update(worker.id, updateData);
      updatedCount++;
    }
  }

  return {
    success: true,
    message: `Aktualizováno ${updatedCount} montážníků.`
  };
}

/**
 * Setup global para testes unitários do frontend.
 *
 * cleanup() após cada teste -> sem isto, o DOM de um render() anterior
 * persiste entre testes no mesmo ficheiro (document.body é global no jsdom),
 * e getByText/queryByText de um teste passam a "ver" elementos de outro.
 */

import { afterEach } from 'vitest';
import { cleanup } from '@testing-library/react';

afterEach(() => {
  cleanup();
});

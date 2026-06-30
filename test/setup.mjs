// Registra o loader de alias "@/" para os testes (node:test).
import { register } from 'node:module';
register('./loader.mjs', import.meta.url);

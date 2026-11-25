import { domLeakCheck } from './leak-checks/dom';
import { listenerLeakCheck } from './leak-checks/listeners';
import { registerLeakChecks } from './leak-checks/register';
import { storageLeakCheck } from './leak-checks/storage';

registerLeakChecks([domLeakCheck, listenerLeakCheck, storageLeakCheck]);

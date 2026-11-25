import { fakeTimerLeakCheck } from './leak-checks/fake-timers';
import { globalLeakCheck } from './leak-checks/globals';
import { registerLeakChecks } from './leak-checks/register';
import { timerLeakCheck } from './leak-checks/timers';

registerLeakChecks([fakeTimerLeakCheck, globalLeakCheck, timerLeakCheck]);

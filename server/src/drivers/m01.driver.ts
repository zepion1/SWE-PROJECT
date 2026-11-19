// M01 Identity and Authorization: driver for login(email, password, otp) -> Session
import { SEED_PASSWORD } from "../db/seed";
import type { LoginInput } from "../modules/m01-identity/service";
import { defineDriver } from "./harness";

const sampleInput: LoginInput = { email: "manager@redhawk.test", password: SEED_PASSWORD, otp: "123456" };

export default defineDriver("M01 Identity and Authorization", sampleInput, (ctx, input) => ctx.identity.login(input));

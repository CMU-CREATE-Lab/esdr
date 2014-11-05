var setFormEnabled = function(form, isEnabled) {
   var submitButton = form.find('input[type=submit]');
   var formInputs = form.find("input");
   if (isEnabled) {
      formInputs.removeAttr("disabled");
      submitButton.removeClass("disabled_submit");
   }
   else {
      formInputs.attr("disabled", "disabled");
      submitButton.addClass("disabled_submit");
   }
};
